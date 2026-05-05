import { useEffect, useRef, useState } from 'react'
import { useEvolutionStore, selectGenerations, selectConfig } from '@/store/evolutionStore'
import type { GenerationEvent } from '@/types/evolution'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType = 'ELITE' | 'MUTATED' | 'CROSSED' | 'STRUGGLING' | 'SHOCKED' | 'CONVERGING'

interface AgentMessage {
  id: string
  type: MessageType
  agentId: string
  text: string
  generation: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<MessageType, { border: string; tag: string }> = {
  ELITE:      { border: '#00FF88', tag: 'ELITE'      },
  MUTATED:    { border: '#F59E0B', tag: 'MUTATED'    },
  CROSSED:    { border: '#A855F7', tag: 'CROSSED'    },
  STRUGGLING: { border: '#FF4560', tag: 'STRUGGLING' },
  SHOCKED:    { border: '#F97316', tag: 'SHOCKED'    },
  CONVERGING: { border: '#00F0FF', tag: 'CONVERGING' },
}

const MAX_MESSAGES = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fakeId() {
  return 'AGT-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

function shortId(id: string) {
  return 'AGT-' + id.slice(-6).toUpperCase()
}

function blocks(value: number, total = 10): string {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * total)
  return '█'.repeat(filled) + '░'.repeat(total - filled)
}

// ─── Message generation ───────────────────────────────────────────────────────

function makeMessages(ev: GenerationEvent, prevGens: GenerationEvent[]): AgentMessage[] {
  const { generation, topFitness, avgFitness, worstFitness, delta, bestAgent, converged } = ev
  const msgs: AgentMessage[] = []

  const push = (type: MessageType, agentId: string, text: string) => {
    msgs.push({
      id: `${generation}-${type}-${Math.random().toString(36).slice(2, 7)}`,
      type, agentId, text, generation,
    })
  }

  if (delta < -0.1) {
    push('SHOCKED', fakeId(),
      `SHOCK EVENT. My genome was randomly reset. Starting fresh. Sometimes chaos leads to better solutions.`)
  }

  if (topFitness > 0.95) {
    push('ELITE', shortId(bestAgent.id),
      `I am the strongest this generation. Fitness: ${(topFitness * 100).toFixed(3)}%. Do not mutate me. I will pass my genes forward unchanged.`)
  }

  if (delta > 0.01) {
    const genome = bestAgent.genome
    const geneIndex = Math.floor(Math.random() * genome.length)
    const newVal = genome[geneIndex]
    const oldVal = newVal - delta * (0.4 + Math.random() * 0.4)
    push('MUTATED', shortId(bestAgent.id),
      `I just mutated gene ${geneIndex}. Changed from ${oldVal.toFixed(4)} to ${newVal.toFixed(4)}. Fitness improved by ${(delta * 100).toFixed(3)}%. Keeping this change.`)
  }

  if (generation > 0 && generation % 3 === 0) {
    const pA = fakeId(), pB = fakeId()
    push('CROSSED', fakeId(),
      `I am a child of ${pA} and ${pB}. I inherited the best genes from both. Let's see if I can beat my parents.`)
  }

  if (worstFitness < avgFitness * 0.7 && worstFitness > 0) {
    push('STRUGGLING', fakeId(),
      `My fitness is only ${(worstFitness * 100).toFixed(3)}%. I am below average. I may not survive to the next generation.`)
  }

  const last10 = [...prevGens.slice(-9), ev]
  if (last10.length >= 10 && last10.every(g => Math.abs(g.delta) < 0.001) && generation % 10 === 0) {
    push('CONVERGING', 'POPULATION',
      `Population is converging. We all look similar now. Either we found the answer or we are stuck.`)
  } else if (converged && msgs.length === 0) {
    push('CONVERGING', 'POPULATION',
      `Population is converging. We all look similar now. Either we found the answer or we are stuck.`)
  }

  if (msgs.length === 0 && generation > 0) {
    push('MUTATED', shortId(bestAgent.id),
      `Generation ${generation} complete. Top fitness: ${(topFitness * 100).toFixed(3)}%. Population evaluating next moves.`)
  }

  return msgs
}

// ─── State of Mind panel ──────────────────────────────────────────────────────

function StateOfMind() {
  const generations = useEvolutionStore(selectGenerations)
  const config      = useEvolutionStore(selectConfig)

  const latest  = generations[generations.length - 1]
  const last10  = generations.slice(-10)

  const confidence = latest?.topFitness ?? 0

  const avgAbsDelta = last10.length > 0
    ? last10.reduce((s, g) => s + Math.abs(g.delta), 0) / last10.length
    : 0
  const stability = Math.max(0, Math.min(1, 1 - avgAbsDelta * 20))
  const curiosity = 1 - stability

  const aggression = latest?.mutationRate ?? config.mutationRate

  const metrics: { label: string; value: number; desc: string }[] = [
    {
      label: 'CONFIDENCE',
      value: confidence,
      desc: confidence > 0.8
        ? 'I believe I am close to the optimal solution'
        : confidence > 0.4
        ? 'Progress is steady — still room to grow'
        : 'Still searching for strong solutions',
    },
    {
      label: 'CURIOSITY',
      value: curiosity,
      desc: curiosity > 0.5
        ? 'There may be better gene combinations unexplored'
        : 'Most of the search space has been covered',
    },
    {
      label: 'STABILITY',
      value: stability,
      desc: stability > 0.8
        ? 'My genome has barely changed in 5 generations'
        : stability > 0.4
        ? 'Moderate changes occurring each generation'
        : 'Still evolving rapidly — high variance',
    },
    {
      label: 'AGGRESSION',
      value: aggression,
      desc: aggression > 0.15
        ? 'High mutation rate — aggressive exploration'
        : 'Low mutation rate — I am being careful',
    },
  ]

  return (
    <div
      className="shrink-0 px-4 py-3 flex flex-col gap-2"
      style={{
        background: '#0E1116',
        borderBottom: '1px solid rgba(0,240,255,0.08)',
      }}
    >
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#A7B0B7',
        fontSize: '9px',
        letterSpacing: '0.14em',
        marginBottom: '2px',
      }}>
        STATE OF MIND — BEST AGENT
      </span>

      {metrics.map(({ label, value, desc }) => (
        <div key={label} className="flex items-start gap-3">
          {/* Label */}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            color: '#A7B0B7',
            fontSize: '10px',
            width: '84px',
            flexShrink: 0,
            paddingTop: '1px',
          }}>
            {label}:
          </span>

          {/* Bar + pct */}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            color: '#00F0FF',
            fontSize: '11px',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}>
            {blocks(value)}{'  '}{Math.round(value * 100)}%
          </span>

          {/* Description */}
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#A7B0B7',
            fontSize: '11px',
            opacity: 0.7,
            paddingTop: '1px',
          }}>
            "{desc}"
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentComms() {
  const generations = useEvolutionStore(selectGenerations)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const bottomRef  = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(generations.length)

  useEffect(() => {
    if (generations.length === prevLenRef.current) return
    const prevLen = prevLenRef.current
    prevLenRef.current = generations.length
    const newGens = generations.slice(prevLen)

    const incoming = newGens.flatMap((ev, i) =>
      makeMessages(ev, generations.slice(0, prevLen + i))
    )

    setMessages(prev => [...prev, ...incoming].slice(-MAX_MESSAGES))
  }, [generations.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full" style={{ background: '#07080A' }}>

      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(0,240,255,0.08)' }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#00F0FF', fontSize: '10px', letterSpacing: '0.12em' }}>
          AGENT COMMS
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#A7B0B7', fontSize: '10px' }}>
          — {messages.length}/{MAX_MESSAGES}
        </span>
        <div className="hidden md:flex items-center gap-2 ml-auto">
          {(Object.entries(TYPE_META) as [MessageType, { border: string; tag: string }][]).map(([, meta]) => (
            <span
              key={meta.tag}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: meta.border, opacity: 0.55, letterSpacing: '0.08em' }}
            >
              {meta.tag}
            </span>
          ))}
        </div>
      </div>

      {/* State of Mind */}
      <StateOfMind />

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-32">
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#A7B0B7', fontSize: '11px', opacity: 0.4 }}>
              Waiting for evolution to start...
            </span>
          </div>
        ) : (
          messages.map(msg => {
            const meta = TYPE_META[msg.type]
            return (
              <div
                key={msg.id}
                style={{
                  borderLeft: `2px solid ${meta.border}`,
                  background: `${meta.border}12`,
                  borderRadius: '0 6px 6px 0',
                  padding: '8px 12px',
                  animation: 'agentSlideUp 0.18s ease-out both',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#00F0FF', fontSize: '11px', fontWeight: 600 }}>
                    {msg.agentId}
                  </span>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: meta.border,
                    fontSize: '9px',
                    letterSpacing: '0.1em',
                    padding: '1px 5px',
                    border: `1px solid ${meta.border}40`,
                    borderRadius: '3px',
                  }}>
                    {meta.tag}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#A7B0B7', fontSize: '9px', marginLeft: 'auto', opacity: 0.45 }}>
                    GEN {String(msg.generation).padStart(5, '0')}
                  </span>
                </div>
                <p style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#F4F6F8', fontSize: '13px', lineHeight: 1.55, margin: 0 }}>
                  {msg.text}
                </p>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes agentSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  )
}
