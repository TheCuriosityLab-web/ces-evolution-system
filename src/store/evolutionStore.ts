import { create } from 'zustand'
import type {
  Agent,
  EvolutionConfig,
  EvolutionStatus,
  GenerationEvent,
  MutationOperator,
} from '@/types/evolution'

interface EvolutionState {
  status: EvolutionStatus
  generations: GenerationEvent[]
  selectedAgent: Agent | null
  config: EvolutionConfig

  // derived / convenience
  currentGeneration: number
  bestFitnessEver: number

  csvData: Record<string, string>[] | null
  targetColumn: string | null
  featureColumns: string[]

  user: { email: string; plan: 'free' | 'pro' | 'team' } | null

  // actions
  appendGeneration: (event: GenerationEvent) => void
  setStatus: (status: EvolutionStatus) => void
  selectAgent: (agent: Agent | null) => void
  setMutationRate: (rate: number) => void
  setPopulationSize: (size: number) => void
  setMutationOperator: (op: MutationOperator) => void
  updateConfig: (patch: Partial<EvolutionConfig>) => void
  setCSVData: (data: Record<string, string>[] | null) => void
  setTargetColumn: (col: string | null) => void
  setFeatureColumns: (cols: string[]) => void
  setUser: (user: { email: string; plan: 'free' | 'pro' | 'team' } | null) => void
  clearUser: () => void
  reset: () => void
}

const DEFAULT_CONFIG: EvolutionConfig = {
  mutationRate: 0.05,
  populationSize: 50,
  mutationOperator: 'gaussian',
  crossoverRate: 0.7,
  elitismCount: 2,
  genomeSize: 32,
  maxGenerations: 1000,
  convergenceThreshold: 0.001,
}

export const useEvolutionStore = create<EvolutionState>((set, get) => ({
  status: 'DISCONNECTED',
  generations: [],
  selectedAgent: null,
  config: { ...DEFAULT_CONFIG },
  currentGeneration: 0,
  bestFitnessEver: 0,
  csvData: null,
  targetColumn: null,
  featureColumns: [],
  user: null,

  appendGeneration: (event) =>
    set((state) => {
      const bestFitnessEver = Math.max(state.bestFitnessEver, event.topFitness)
      const nextStatus: EvolutionStatus = event.converged ? 'CONVERGED' : state.status
      return {
        generations: [...state.generations, event],
        currentGeneration: event.generation,
        bestFitnessEver,
        status: nextStatus,
        // auto-select new best agent each generation
        selectedAgent: event.bestAgent,
      }
    }),

  setStatus: (status) => set({ status }),

  selectAgent: (agent) => set({ selectedAgent: agent }),

  setMutationRate: (rate) =>
    set((state) => ({ config: { ...state.config, mutationRate: rate } })),

  setPopulationSize: (size) =>
    set((state) => ({ config: { ...state.config, populationSize: size } })),

  setMutationOperator: (op) =>
    set((state) => ({ config: { ...state.config, mutationOperator: op } })),

  updateConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),

  setCSVData: (data) => set({ csvData: data }),
  setTargetColumn: (col) => set({ targetColumn: col }),
  setFeatureColumns: (cols) => set({ featureColumns: cols }),
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  reset: () =>
    set({
      status: 'DISCONNECTED',
      generations: [],
      selectedAgent: null,
      config: { ...DEFAULT_CONFIG },
      currentGeneration: 0,
      bestFitnessEver: 0,
      csvData: null,
      targetColumn: null,
      featureColumns: [],
    }),
}))

// Convenience selectors (stable references — avoids inline selector recreation)
export const selectStatus = (s: EvolutionState) => s.status
export const selectGenerations = (s: EvolutionState) => s.generations
export const selectSelectedAgent = (s: EvolutionState) => s.selectedAgent
export const selectConfig = (s: EvolutionState) => s.config
export const selectCurrentGeneration = (s: EvolutionState) => s.currentGeneration
export const selectBestFitnessEver = (s: EvolutionState) => s.bestFitnessEver
export const selectUser = (s: EvolutionState) => s.user
