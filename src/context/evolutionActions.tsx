import { createContext, useContext, type ReactNode } from 'react'
import { useEvolution } from '@/hooks/useEvolution'

type EvolutionActions = ReturnType<typeof useEvolution>

const EvolutionActionsContext = createContext<EvolutionActions | null>(null)

export function EvolutionActionsProvider({ children }: { children: ReactNode }) {
  const actions = useEvolution()
  return (
    <EvolutionActionsContext.Provider value={actions}>
      {children}
    </EvolutionActionsContext.Provider>
  )
}

export function useEvolutionActions(): EvolutionActions {
  const ctx = useContext(EvolutionActionsContext)
  if (!ctx) throw new Error('useEvolutionActions must be used within EvolutionActionsProvider')
  return ctx
}
