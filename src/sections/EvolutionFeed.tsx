import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useEvolutionStore, selectGenerations, selectStatus } from '@/store/evolutionStore'
import type { GenerationEvent } from '@/types/evolution'

// ─── Single generation card ───────────────────────────────────────────────────
function GenCard({ event, isLatest }: { event: GenerationEvent; isLatest: boolean }) {
  const deltaPositive = event.delta >= 0
  const deltaAbs      = Math.abs(event.delta)
  const mutPct        = Math.round(event.mutationRate * 100)

  return (
    <div
      className={`${isLatest ? 'animate-slide-in-bottom' : ''}`}
    >
      <Card className="p-3 mb-2 transition-all duration-200 hover:border-accent/20 hover:shadow-glow">
        <div className="flex items-start justify-between gap-3">
          {/* Left: gen number + operator badge */}
          <div className="flex flex-col gap-1 min-w-[52px]">
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">Gen</span>
            <span className="font-mono text-lg font-semibold text-accent tabular-nums leading-none">
              {String(event.generation).padStart(4, '0')}
            </span>
            <Badge variant="outline" className="mt-0.5 text-[9px] px-1.5 py-0 w-fit">
              {event.bestAgent.mutationOperator.slice(0, 3).toUpperCase()}
            </Badge>
          </div>

          {/* Centre: fitness values */}
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
            <div>
              <p className="font-mono text-[9px] text-text-secondary uppercase tracking-widest">Top Fitness</p>
              <p className="font-mono text-sm font-semibold text-text-primary tabular-nums">
                {event.topFitness.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-text-secondary uppercase tracking-widest">Avg Fitness</p>
              <p className="font-mono text-sm text-text-secondary tabular-nums">
                {event.avgFitness.toFixed(6)}
              </p>
            </div>

            {/* Delta */}
            <div className="col-span-2 flex items-center gap-1.5 mt-0.5">
              <span
                className={`font-mono text-xs tabular-nums font-medium ${
                  deltaPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {deltaPositive ? '▲' : '▼'} {deltaAbs.toFixed(6)}
              </span>
              {event.converged && (
                <Badge variant="converged" className="text-[9px] px-1.5 py-0">
                  CONVERGED
                </Badge>
              )}
            </div>
          </div>

          {/* Right: mutation rate bar + pop size */}
          <div className="flex flex-col gap-1 items-end min-w-[56px]">
            <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest">Mut</span>
            <span className="font-mono text-xs text-text-primary tabular-nums">{mutPct}%</span>
            {/* Vertical bar */}
            <div className="w-1 h-10 bg-bg rounded-full overflow-hidden">
              <div
                className="w-full bg-accent rounded-full transition-all duration-300"
                style={{
                  height:     `${mutPct}%`,
                  marginTop:  `${100 - mutPct}%`,
                  boxShadow:  mutPct > 50 ? '0 0 6px rgba(0,240,255,0.5)' : 'none',
                }}
              />
            </div>
            <span className="font-mono text-[9px] text-text-secondary/60 tabular-nums">
              ×{event.populationSize}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Ticker strip (bottom bar mode) ──────────────────────────────────────────
export function EvolutionTicker() {
  const generations = useEvolutionStore(selectGenerations)
  const status      = useEvolutionStore(selectStatus)
  const latest      = generations[generations.length - 1]

  if (!latest) {
    return (
      <div className="flex items-center gap-3 px-4 h-full">
        <span className="font-mono text-[10px] text-text-secondary/40 uppercase tracking-widest">
          Awaiting evolution…
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6 px-4 h-full overflow-hidden">
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          status === 'EVOLVING' ? 'bg-accent animate-pulse' : 'bg-text-secondary/30'
        }`}
      />

      {/* Scrolling tape of last 20 events */}
      <div className="flex items-center gap-4 overflow-hidden">
        {generations.slice(-20).map((ev) => (
          <div key={ev.generation} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[10px] text-text-secondary/50">
              G{String(ev.generation).padStart(4, '0')}
            </span>
            <span className="font-mono text-[10px] text-accent tabular-nums">
              {ev.topFitness.toFixed(4)}
            </span>
            <span
              className={`font-mono text-[9px] tabular-nums ${
                ev.delta >= 0 ? 'text-green-400/70' : 'text-red-400/70'
              }`}
            >
              {ev.delta >= 0 ? '+' : ''}{ev.delta.toFixed(4)}
            </span>
            <span className="text-accent/10 mx-1">│</span>
          </div>
        ))}
      </div>

      <span className="font-mono text-[10px] text-text-secondary/40 shrink-0 ml-auto pr-2">
        {generations.length} GENERATIONS
      </span>
    </div>
  )
}

// ─── Full feed panel ──────────────────────────────────────────────────────────
export function EvolutionFeed() {
  const generations = useEvolutionStore(selectGenerations)
  const status      = useEvolutionStore(selectStatus)
  const bottomRef   = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest on each new event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [generations.length])

  const reversed = [...generations].reverse()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/[0.08]">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'EVOLVING' ? 'bg-accent animate-pulse' : 'bg-text-secondary/30'
            }`}
          />
          <h2 className="font-heading text-sm font-semibold text-text-primary">Evolution Feed</h2>
        </div>
        <Badge
          variant={
            status === 'EVOLVING'   ? 'evolving'
            : status === 'PAUSED'  ? 'paused'
            : status === 'CONVERGED' ? 'converged'
            : 'disconnected'
          }
          className="text-[10px]"
        >
          {status}
        </Badge>
      </div>

      {/* Empty state */}
      {generations.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-6">
          <div className="w-8 h-8 rounded-full border border-accent/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-accent/30" />
          </div>
          <p className="font-mono text-xs text-text-secondary/50">
            Press <span className="text-accent">Start</span> to begin evolution
          </p>
        </div>
      )}

      {/* Card list — newest on top */}
      {generations.length > 0 && (
        <ScrollArea className="flex-1 px-3 pt-3">
          {reversed.map((ev, i) => (
            <GenCard key={ev.generation} event={ev} isLatest={i === 0} />
          ))}
          <div ref={bottomRef} className="h-2" />
        </ScrollArea>
      )}

      {/* Summary footer */}
      {generations.length > 0 && (
        <div className="border-t border-accent/[0.08] px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-text-secondary/50">
            {generations.length} events logged
          </span>
          <span className="font-mono text-[10px] text-accent/60 tabular-nums">
            PEAK {(Math.max(...generations.map((g) => g.topFitness)) * 100).toFixed(3)}%
          </span>
        </div>
      )}
    </div>
  )
}
