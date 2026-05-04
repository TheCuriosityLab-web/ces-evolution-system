import { useCallback, useEffect, useRef } from 'react'
import { useEvolutionStore } from '@/store/evolutionStore'
import type { Agent, GenerationEvent, LayerSpec, MutationOperator } from '@/types/evolution'

// ─── Fitness ────────────────────────────────────────────────────────────────

function sineWaveFitness(genome: number[]): number {
  const raw = genome.reduce((sum, g, i) => sum + Math.sin(g * (i + 1)), 0) / genome.length
  return (raw + 1) / 2
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, denomX = 0, denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num    += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  const denom = Math.sqrt(denomX * denomY)
  return denom === 0 ? 0 : num / denom
}

function csvCorrelationFitness(
  genome: number[],
  csvData: Record<string, string>[],
  targetColumn: string,
  featureColumns: string[],
): number {
  const preds: number[]   = []
  const targets: number[] = []
  for (const row of csvData) {
    const target = parseFloat(row[targetColumn])
    if (isNaN(target)) continue
    let pred = 0
    for (let j = 0; j < featureColumns.length; j++) {
      const val = parseFloat(row[featureColumns[j]])
      if (!isNaN(val)) pred += genome[j % genome.length] * val
    }
    preds.push(pred)
    targets.push(target)
  }
  if (preds.length < 2) return 0
  // Pearson r ∈ [-1, 1] → normalise to [0, 1]
  return (pearsonCorrelation(preds, targets) + 1) / 2
}

function fitnessOf(
  genome: number[],
  csvData?: Record<string, string>[] | null,
  targetColumn?: string | null,
  featureColumns?: string[],
): number {
  if (csvData && csvData.length > 0 && targetColumn && featureColumns && featureColumns.length > 0) {
    return csvCorrelationFitness(genome, csvData, targetColumn, featureColumns)
  }
  return sineWaveFitness(genome)
}

// ─── Population init ────────────────────────────────────────────────────────
function initPop(
  size: number,
  genomeSize: number,
  fitFn: (g: number[]) => number,
): Array<{ genome: number[]; fitness: number }> {
  return Array.from({ length: size }, () => {
    const genome = Array.from({ length: genomeSize }, () => (Math.random() * 2 - 1) * Math.PI)
    return { genome, fitness: fitFn(genome) }
  })
}

// ─── Selection ──────────────────────────────────────────────────────────────
function tournamentSelect(
  pop: Array<{ genome: number[]; fitness: number }>,
  k = 3
): number[] {
  let best = pop[Math.floor(Math.random() * pop.length)]
  for (let i = 1; i < k; i++) {
    const c = pop[Math.floor(Math.random() * pop.length)]
    if (c.fitness > best.fitness) best = c
  }
  return best.genome
}

// ─── Crossover ──────────────────────────────────────────────────────────────
function crossover(a: number[], b: number[], rate: number): number[] {
  return a.map((g, i) => (Math.random() < rate ? g : b[i]))
}

// ─── Mutation operators ─────────────────────────────────────────────────────
function mutateGaussian(genome: number[], rate: number): number[] {
  return genome.map((g) =>
    Math.random() < rate ? g + (Math.random() * 2 - 1) * 0.4 : g
  )
}

function mutateUniform(genome: number[], rate: number): number[] {
  return genome.map((g) =>
    Math.random() < rate ? (Math.random() * 2 - 1) * Math.PI : g
  )
}

function mutateAdaptive(genome: number[], rate: number, rank: number, popSize: number): number[] {
  // Sigma shrinks as rank improves — top agents mutate less
  const sigma = rate * (1 - rank / popSize) * 0.6 + 0.02
  return genome.map((g) =>
    Math.random() < rate ? g + (Math.random() * 2 - 1) * sigma : g
  )
}

function applyMutation(
  genome: number[],
  rate: number,
  op: MutationOperator,
  rank: number,
  popSize: number
): number[] {
  switch (op) {
    case 'gaussian': return mutateGaussian(genome, rate)
    case 'uniform':  return mutateUniform(genome, rate)
    case 'adaptive': return mutateAdaptive(genome, rate, rank, popSize)
  }
}

// ─── Layer topology from genome ─────────────────────────────────────────────
// Fixed topology: [3 → 6 → 6 → 3 → 1]. Weights are sampled cyclically from genome.
const TOPOLOGY: Array<{ size: number; type: 'input' | 'hidden' | 'output'; activation: LayerSpec['activation'] }> = [
  { size: 3,  type: 'input',  activation: 'linear'  },
  { size: 6,  type: 'hidden', activation: 'relu'    },
  { size: 6,  type: 'hidden', activation: 'tanh'    },
  { size: 3,  type: 'hidden', activation: 'relu'    },
  { size: 1,  type: 'output', activation: 'sigmoid' },
]

function buildLayers(genome: number[]): LayerSpec[] {
  return TOPOLOGY.map((spec, layerIdx) => {
    const nextSize = TOPOLOGY[layerIdx + 1]?.size ?? 0
    const weights: number[][] = Array.from({ length: spec.size }, (_, from) =>
      Array.from({ length: nextSize }, (_, to) => {
        const idx = (layerIdx * 13 + from * 7 + to * 3) % genome.length
        return genome[idx]
      })
    )
    const bias = Array.from({ length: spec.size }, (_, n) => {
      const idx = (layerIdx * 5 + n * 11) % genome.length
      return genome[idx] * 0.1
    })
    return {
      id:         `layer-${layerIdx}`,
      index:      layerIdx,
      type:       spec.type,
      size:       spec.size,
      activation: spec.activation,
      weights,
      bias,
    }
  })
}

// ─── Agent factory ───────────────────────────────────────────────────────────
function makeAgent(
  genome: number[],
  generation: number,
  op: MutationOperator,
  fitFn: (g: number[]) => number,
  age = 0,
): Agent {
  return {
    id: `g${generation}-${Math.random().toString(36).slice(2, 6)}`,
    generation,
    genome,
    fitness: fitFn(genome),
    layers: buildLayers(genome),
    mutationOperator: op,
    age,
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
type Individual = { genome: number[]; fitness: number }

export function useEvolution() {
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const popRef         = useRef<Individual[]>([])
  const genCountRef    = useRef(0)
  const prevTopRef     = useRef(0)

  const { appendGeneration, setStatus, reset: storeReset } = useEvolutionStore()

  // Always reads fresh config from the store — safe inside setInterval
  const tick = useCallback(() => {
    const { config, csvData, targetColumn, featureColumns } = useEvolutionStore.getState()
    const {
      mutationRate, populationSize, mutationOperator,
      crossoverRate, elitismCount, genomeSize, convergenceThreshold,
    } = config

    const fitFn = (g: number[]) => fitnessOf(g, csvData, targetColumn, featureColumns)

    // Lazy-init or resize population
    if (popRef.current.length === 0) {
      popRef.current = initPop(populationSize, genomeSize, fitFn)
    } else if (popRef.current.length !== populationSize) {
      // User changed population size while paused
      const extras = initPop(Math.max(0, populationSize - popRef.current.length), genomeSize, fitFn)
      popRef.current = [...popRef.current.slice(0, populationSize), ...extras]
    }

    // Sort descending by fitness
    popRef.current.sort((a, b) => b.fitness - a.fitness)

    const elites = popRef.current.slice(0, elitismCount)
    const next: Individual[] = elites.map((e) => ({ ...e }))

    while (next.length < populationSize) {
      const rank = next.length
      const pA = tournamentSelect(popRef.current)
      const pB = tournamentSelect(popRef.current)
      const child = applyMutation(crossover(pA, pB, crossoverRate), mutationRate, mutationOperator, rank, populationSize)
      next.push({ genome: child, fitness: fitFn(child) })
    }

    popRef.current = next
    genCountRef.current += 1

    const fitnesses = next.map((a) => a.fitness)
    const topFitness   = fitnesses[0]   // already sorted
    const avgFitness   = fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length
    const worstFitness = fitnesses[fitnesses.length - 1]
    const delta        = topFitness - prevTopRef.current
    prevTopRef.current = topFitness

    const opFreq: Record<MutationOperator, number> = { gaussian: 0, uniform: 0, adaptive: 0 }
    opFreq[mutationOperator] = populationSize

    const bestAgent = makeAgent(next[0].genome, genCountRef.current, mutationOperator, fitFn)

    // Converge if delta has stalled for many generations and we're not just starting
    const converged =
      genCountRef.current > 20 && Math.abs(delta) < convergenceThreshold && topFitness > 0.85

    const event: GenerationEvent = {
      generation:          genCountRef.current,
      timestamp:           Date.now(),
      topFitness,
      avgFitness,
      worstFitness,
      delta,
      mutationRate,
      populationSize,
      bestAgent,
      mutationOperatorFreq: opFreq,
      converged,
    }

    appendGeneration(event)
  }, [appendGeneration])

  // Keep tickRef fresh so the interval always calls the latest closure
  const tickRef = useRef(tick)
  useEffect(() => { tickRef.current = tick }, [tick])

  // ── Public API ──────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (intervalRef.current) return
    setStatus('EVOLVING')
    intervalRef.current = setInterval(() => tickRef.current(), 1500)
  }, [setStatus])

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStatus('PAUSED')
  }, [setStatus])

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    popRef.current      = []
    genCountRef.current = 0
    prevTopRef.current  = 0
    storeReset()
  }, [storeReset])

  const injectMutation = useCallback((rate: number) => {
    const { csvData, targetColumn, featureColumns } = useEvolutionStore.getState()
    const fitFn = (g: number[]) => fitnessOf(g, csvData, targetColumn, featureColumns)
    // Perturb the entire current population — simulates an environmental shock
    popRef.current = popRef.current.map(({ genome }) => {
      const g = genome.map((v) => v + (Math.random() * 2 - 1) * rate * Math.PI)
      return { genome: g, fitness: fitFn(g) }
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { start, pause, reset, injectMutation }
}
