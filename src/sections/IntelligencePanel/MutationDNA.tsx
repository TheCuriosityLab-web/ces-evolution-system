import { useMemo } from 'react'
import { useEvolutionStore, selectSelectedAgent, selectGenerations } from '@/store/evolutionStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GeneOrigin, GeneRecord } from '@/types/evolution'

const ORIGIN_COLOR: Record<GeneOrigin, string> = {
  ELITE:     '#00FF88',
  INHERITED: '#00F0FF',
  CROSSED:   '#B8A0FF',
  MUTATED:   '#FFB800',
  SHOCKED:   '#FF4560',
}

function classifyOrigin(delta: number): GeneOrigin {
  const abs = Math.abs(delta)
  if (abs < 0.0001) return 'ELITE'
  if (abs > 0.3)    return 'SHOCKED'
  if (abs > 0.05)   return 'MUTATED'
  if (abs > 0.01)   return 'CROSSED'
  return 'INHERITED'
}

export function MutationDNA() {
  const selectedAgent = useEvolutionStore(selectSelectedAgent)
  const generations   = useEvolutionStore(selectGenerations)

  const { records, counts } = useMemo<{
    records: GeneRecord[]
    counts: Record<GeneOrigin, number>
  }>(() => {
    const empty = { records: [], counts: { ELITE: 0, INHERITED: 0, CROSSED: 0, MUTATED: 0, SHOCKED: 0 } }
    if (!selectedAgent) return empty

    const genome = selectedAgent.genome
    const len    = Math.min(genome.length, 32)

    // Previous genome: best agent from 2 generations ago if available
    const prevGen   = generations.length >= 2 ? generations[generations.length - 2] : null
    const prevGenome = prevGen?.bestAgent?.genome ?? null

    const counts: Record<GeneOrigin, number> = {
      ELITE: 0, INHERITED: 0, CROSSED: 0, MUTATED: 0, SHOCKED: 0,
    }

    const records: GeneRecord[] = Array.from({ length: len }, (_, i) => {
      const value     = genome[i] ?? 0
      const prevValue = prevGenome?.[i] ?? value
      const delta     = value - prevValue
      const origin    = classifyOrigin(delta)
      counts[origin]++
      return {
        index:    i,
        value,
        prevValue,
        origin,
        delta,
        operator: selectedAgent.mutationOperator,
      }
    })

    return { records, counts }
  }, [selectedAgent, generations.length])

  const ORIGINS: GeneOrigin[] = ['ELITE', 'INHERITED', 'CROSSED', 'MUTATED', 'SHOCKED']

  return (
    <div className="flex flex-col h-full gap-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 px-1 shrink-0">
        {ORIGINS.map((o) => (
          <span
            key={o}
            className="text-[9px] font-bold tracking-widest border rounded px-2 py-0.5"
            style={{ color: ORIGIN_COLOR[o], borderColor: `${ORIGIN_COLOR[o]}40`, background: `${ORIGIN_COLOR[o]}12` }}
          >
            {o} {counts[o]}
          </span>
        ))}
      </div>

      {!selectedAgent ? (
        <div className="flex flex-1 items-center justify-center text-[11px] text-[#A7B0B7]">
          No agent selected.
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 pr-3">
            {records.map((r) => {
              const barPct = Math.min(Math.abs(r.value) * 100, 100)
              const color  = ORIGIN_COLOR[r.origin]
              return (
                <div
                  key={r.index}
                  className="flex items-center gap-2 px-2 py-1 rounded text-[10px]"
                  style={{ background: `${color}08` }}
                >
                  {/* Gene index */}
                  <span className="w-6 text-[#A7B0B7] tabular-nums text-right shrink-0">
                    {String(r.index).padStart(2, '0')}
                  </span>

                  {/* Bar */}
                  <div className="relative w-24 h-2 bg-white/5 rounded-sm overflow-hidden shrink-0">
                    <div
                      className="absolute left-0 top-0 h-full rounded-sm"
                      style={{ width: `${barPct}%`, background: color }}
                    />
                  </div>

                  {/* Value */}
                  <span className="w-16 tabular-nums shrink-0" style={{ color }}>
                    {r.value.toFixed(3)}
                  </span>

                  {/* Delta */}
                  <span
                    className="w-16 tabular-nums shrink-0"
                    style={{ color: r.delta >= 0 ? '#00FF88' : '#FF4560' }}
                  >
                    {r.delta >= 0 ? '+' : ''}{r.delta.toFixed(4)}
                  </span>

                  {/* Origin label */}
                  <span
                    className="text-[9px] font-bold tracking-widest border rounded px-1.5 py-0.5 shrink-0"
                    style={{ color, borderColor: `${color}40`, background: `${color}15` }}
                  >
                    {r.origin}
                  </span>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
