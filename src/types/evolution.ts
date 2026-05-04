export type EvolutionStatus = 'EVOLVING' | 'PAUSED' | 'CONVERGED' | 'DISCONNECTED'

export type MutationOperator = 'gaussian' | 'uniform' | 'adaptive'

export interface FitnessPoint {
  generation: number
  topFitness: number
  avgFitness: number
  timestamp: number
}

export interface Agent {
  id: string
  generation: number
  genome: number[]         // array of weights, length = genomeSize
  fitness: number
  layers: LayerSpec[]
  mutationOperator: MutationOperator
  age: number              // how many generations this agent has survived
}

export interface LayerSpec {
  id: string
  index: number
  type: 'input' | 'hidden' | 'output'
  size: number             // number of neurons
  activation: 'relu' | 'sigmoid' | 'tanh' | 'linear'
  weights: number[][]      // [fromNeuron][toNeuron] for edges to next layer
  bias: number[]
}

export interface GenerationEvent {
  generation: number
  timestamp: number
  topFitness: number
  avgFitness: number
  worstFitness: number
  delta: number            // topFitness - prev topFitness
  mutationRate: number
  populationSize: number
  bestAgent: Agent
  mutationOperatorFreq: Record<MutationOperator, number>
  converged: boolean
}

export interface EvolutionConfig {
  mutationRate: number           // 0–1
  populationSize: number         // 10–200
  mutationOperator: MutationOperator
  crossoverRate: number          // 0–1
  elitismCount: number
  genomeSize: number
  maxGenerations: number
  convergenceThreshold: number
}

export type LearningPhase = 'EXPLORING' | 'DISCOVERING' | 'EXPLOITING' | 'FINE_TUNING' | 'CONVERGED'

export interface LearningMilestone {
  generation: number
  phase: LearningPhase
  fitness: number
  note: string
}

export type GeneOrigin = 'INHERITED' | 'MUTATED' | 'CROSSED' | 'ELITE' | 'SHOCKED'

export interface GeneRecord {
  index: number
  value: number
  prevValue: number
  origin: GeneOrigin
  delta: number
  operator: MutationOperator
}

export interface ConsumptionStats {
  totalEvaluations: number
  evaluationsPerGen: number
  totalWeightValues: number
  fitnessCallsPerSec: number
  dataPointsConsumed: number
  selectionPressure: number
  diversityIndex: number
}
