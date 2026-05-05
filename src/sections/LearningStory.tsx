import {
  useEvolutionStore,
  selectGenerations,
  selectStatus,
  selectCurrentGeneration,
  selectBestFitnessEver,
  selectConfig,
  selectSelectedAgent,
} from '@/store/evolutionStore'

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }
const SANS: React.CSSProperties = { fontFamily: "'Inter', sans-serif" }

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl p-5"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-white" style={SANS}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Plain-English stat card ──────────────────────────────────────────────────
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-4 gap-1 text-center"
      style={{ background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.12)' }}
    >
      <span className="text-2xl font-bold text-[#00F0FF]" style={MONO}>{value}</span>
      <span className="text-sm text-[#A7B0B7]" style={SANS}>{label}</span>
    </div>
  )
}

// ─── Timeline phase row ───────────────────────────────────────────────────────
function PhaseRow({
  emoji, label, reached, active,
}: {
  emoji: string; label: string; reached: boolean; active: boolean
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3"
      style={{
        background: active  ? 'rgba(0,240,255,0.06)'
                 : reached ? 'rgba(255,255,255,0.02)'
                 : 'transparent',
        border: active  ? '1px solid rgba(0,240,255,0.2)'
              : reached ? '1px solid rgba(255,255,255,0.05)'
              : '1px solid transparent',
        opacity: reached ? 1 : 0.35,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1.4 }}>{emoji}</span>
      <span className="text-[15px] leading-relaxed text-[#D0D8E0]" style={SANS}>{label}</span>
      {active && (
        <span
          className="ml-auto shrink-0 text-[10px] font-bold tracking-widest uppercase rounded px-2 py-0.5"
          style={{ background: 'rgba(0,240,255,0.12)', color: '#00F0FF', ...MONO }}
        >
          now
        </span>
      )}
    </div>
  )
}

// ─── LearningStory ───────────────────────────────────────────────────────────
export function LearningStory() {
  const generations = useEvolutionStore(selectGenerations)
  const status      = useEvolutionStore(selectStatus)
  const generation  = useEvolutionStore(selectCurrentGeneration)
  const bestEver    = useEvolutionStore(selectBestFitnessEver)
  const config      = useEvolutionStore(selectConfig)
  const agent       = useEvolutionStore(selectSelectedAgent)

  const hasData = generation > 0

  // ── Phase detection ──────────────────────────────────────────────────────
  const isConverged = status === 'CONVERGED'
  const inEarly     = hasData && generation <= 20
  const inMiddle    = hasData && generation > 20 && generation <= 100
  const inLate      = hasData && generation > 100 && !isConverged
  const activePhase = isConverged ? 'converged'
    : generation > 100 ? 'late'
    : generation > 20  ? 'middle'
    : hasData          ? 'early'
    : null

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalSolutions = generations.reduce((sum, g) => sum + g.populationSize, 0)
  const totalMutations = Math.round(
    generations.reduce((sum, g) => sum + g.populationSize * g.mutationRate, 0)
  )
  const elitePercent   = config.populationSize > 0
    ? ((config.elitismCount / config.populationSize) * 100).toFixed(0)
    : '0'
  const fitnessPercent = (bestEver * 100).toFixed(1)

  // ── Example genome for diagram ────────────────────────────────────────────
  const parentA = agent?.genome.slice(0, 4) ?? [0.8, 0.3, 0.9, 0.6]
  const parentB = parentA.map((v) => parseFloat(((1 - v) * 0.9 + Math.random() * 0.1).toFixed(1)))
  const child   = parentA.map((v, i) =>
    parseFloat(i % 2 === 0 ? v.toFixed(1) : (parentB[i] + (Math.random() - 0.5) * 0.05).toFixed(1))
  )
  const highlight = [false, true, false, true]

  const fmtGene = (g: number[]) =>
    '[' + g.map((v) => v.toFixed(1)).join(', ') + ', ...]'

  return (
    <div className="flex flex-col gap-5">

      {/* ── SECTION 1 ─────────────────────────────────────────────────────── */}
      <Section emoji="🧠" title="What Was It Trying To Do?">
        <p className="text-[15px] leading-relaxed text-[#C8D2DC]" style={SANS}>
          The AI was trying to find the perfect combination of{' '}
          <span className="text-white font-semibold">{config.genomeSize} numbers</span> (called
          genes) that would score as high as possible on a mathematical test. Think of it like
          tuning <span className="text-white font-semibold">{config.genomeSize} dials</span> until
          you get the best radio signal — each dial is a small weight inside an artificial neural
          network.
        </p>
        {!hasData && (
          <p className="text-sm text-[#A7B0B7]/60 italic" style={SANS}>
            Start an evolution run to see the story unfold here.
          </p>
        )}
      </Section>

      {/* ── SECTION 2 ─────────────────────────────────────────────────────── */}
      <Section emoji="📖" title="How Did It Learn?">
        <div className="flex flex-col gap-2">
          <PhaseRow
            emoji="🔍"
            label="Just looking around randomly, trying anything to see what works (generations 1 – 20)"
            reached={hasData}
            active={activePhase === 'early'}
          />
          <PhaseRow
            emoji="📈"
            label="Found some good patterns and started copying and improving them (generations 20 – 100)"
            reached={generation > 20 || isConverged}
            active={activePhase === 'middle'}
          />
          <PhaseRow
            emoji="🎯"
            label="Making tiny adjustments to squeeze out the last bit of improvement (generation 100+)"
            reached={generation > 100 || isConverged}
            active={activePhase === 'late'}
          />
          <PhaseRow
            emoji="✅"
            label="Stopped — found the best possible answer it could find"
            reached={isConverged}
            active={activePhase === 'converged'}
          />
        </div>
      </Section>

      {/* ── SECTION 3 ─────────────────────────────────────────────────────── */}
      <Section emoji="📊" title="What Information Did It Use?">
        {hasData ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              value={totalSolutions.toLocaleString()}
              label="different solutions tested"
            />
            <StatCard
              value={totalMutations.toLocaleString()}
              label="mutations (small random changes)"
            />
            <StatCard
              value={`top ${elitePercent}%`}
              label="kept each round (elites)"
            />
            <StatCard
              value={generation.toLocaleString()}
              label="generations (rounds) run"
            />
            <StatCard
              value={`${fitnessPercent}%`}
              label="accuracy reached"
            />
            <StatCard
              value={config.populationSize.toLocaleString()}
              label="agents per generation"
            />
          </div>
        ) : (
          <p className="text-sm text-[#A7B0B7]/60 italic" style={SANS}>
            Stats will appear once evolution starts.
          </p>
        )}
      </Section>

      {/* ── SECTION 4 ─────────────────────────────────────────────────────── */}
      <Section emoji="🔬" title="How Did Mutations Work?">
        <p className="text-[15px] leading-relaxed text-[#C8D2DC] mb-2" style={SANS}>
          Each round the AI kept the winners, then made slightly changed copies of them.
          Two parents combine genes — some are inherited, some are nudged randomly:
        </p>

        <div
          className="rounded-lg p-4 text-[13px] leading-relaxed overflow-x-auto"
          style={{ background: '#07080A', border: '1px solid rgba(255,255,255,0.07)', ...MONO }}
        >
          <div className="flex flex-col gap-1.5">
            <div>
              <span className="text-[#A7B0B7]">Parent A: </span>
              <span className="text-[#00FF88]">{fmtGene(parentA)}</span>
            </div>
            <div>
              <span className="text-[#A7B0B7]">Parent B: </span>
              <span className="text-[#FFB347]">{fmtGene(parentB)}</span>
            </div>
            <div className="mt-1 border-t border-white/[0.06] pt-2">
              <span className="text-[#A7B0B7]">Child:    </span>
              <span>[</span>
              {child.map((v, i) => (
                <span key={i}>
                  <span style={{ color: highlight[i] ? '#FFB347' : '#00FF88' }}>
                    {v.toFixed(1)}
                  </span>
                  {i < child.length - 1 ? ', ' : ''}
                </span>
              ))}
              <span>, ...]</span>
              <span className="ml-2 text-[#A7B0B7]/50">← mixed from both</span>
            </div>
            <div className="flex gap-4 text-[11px] text-[#A7B0B7]/60 mt-1">
              <span>
                <span className="text-[#00FF88]">■</span> inherited from parent A
              </span>
              <span>
                <span className="text-[#FFB347]">■</span> mutated from parent B
              </span>
            </div>
          </div>
        </div>
      </Section>

    </div>
  )
}
