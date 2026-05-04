import { useMemo } from 'react'
import { useEvolutionStore, selectGenerations } from '@/store/evolutionStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LearningPhase, LearningMilestone } from '@/types/evolution'

function getPhase(fitness: number): LearningPhase {
  if (fitness < 0.35) return 'EXPLORING'
  if (fitness < 0.70) return 'DISCOVERING'
  if (fitness < 0.92) return 'EXPLOITING'
  if (fitness < 0.99) return 'FINE_TUNING'
  return 'CONVERGED'
}

const PHASE_NOTE: Record<LearningPhase, string> = {
  EXPLORING:   'Sampling random genome space, building baseline fitness signal.',
  DISCOVERING: 'Fitness gradients found — selection pressure shaping gene pool.',
  EXPLOITING:  'High-value regions locked in, mutations refining local optima.',
  FINE_TUNING: 'Micro-adjustments converging; near-optimal weights stabilising.',
  CONVERGED:   'Population homogenous — all agents share near-identical genomes.',
}

const PHASE_COLOR: Record<LearningPhase, string> = {
  EXPLORING:   'text-[#A7B0B7] border-[#A7B0B7]/30 bg-[#A7B0B7]/8',
  DISCOVERING: 'text-[#B8A0FF] border-[#B8A0FF]/30 bg-[#B8A0FF]/8',
  EXPLOITING:  'text-[#FFB800] border-[#FFB800]/30 bg-[#FFB800]/8',
  FINE_TUNING: 'text-[#00F0FF] border-[#00F0FF]/30 bg-[#00F0FF]/8',
  CONVERGED:   'text-[#00FF88] border-[#00FF88]/30 bg-[#00FF88]/8',
}

export function LearningLog() {
  const generations = useEvolutionStore(selectGenerations)

  const milestones: LearningMilestone[] = useMemo(() => {
    if (generations.length === 0) return []

    const result: LearningMilestone[] = []
    let lastPhase: LearningPhase | null = null

    for (let i = 0; i < generations.length; i++) {
      const g = generations[i]
      const phase = getPhase(g.topFitness)
      const isSample = g.generation % 5 === 0
      const isPhaseChange = phase !== lastPhase

      if (isSample || isPhaseChange) {
        result.push({
          generation: g.generation,
          phase,
          fitness: g.topFitness,
          note: PHASE_NOTE[phase],
        })
        lastPhase = phase
      }
    }

    return result
  }, [generations])

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {milestones.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[11px] text-[#A7B0B7]">
          No generations recorded yet.
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 pr-3">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 px-3 py-2 rounded"
                style={{ background: idx % 2 === 0 ? 'rgba(0,240,255,0.03)' : 'transparent' }}
              >
                {/* Generation number */}
                <span className="text-[11px] text-[#A7B0B7] tabular-nums w-14 shrink-0 pt-px">
                  GEN {String(m.generation).padStart(5, '0')}
                </span>

                {/* Phase badge */}
                <span
                  className={`text-[9px] font-bold tracking-widest border rounded px-1.5 py-0.5 shrink-0 ${PHASE_COLOR[m.phase]}`}
                >
                  {m.phase.replace('_', ' ')}
                </span>

                {/* Fitness */}
                <span className="text-[11px] text-[#00F0FF] tabular-nums w-16 shrink-0 pt-px">
                  {(m.fitness * 100).toFixed(2)}%
                </span>

                {/* Note */}
                <span className="text-[10px] text-[#A7B0B7]/70 leading-tight">
                  {m.note}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
