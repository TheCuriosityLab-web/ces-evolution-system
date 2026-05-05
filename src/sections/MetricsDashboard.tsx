import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEvolutionStore, selectGenerations } from '@/store/evolutionStore'
import type { GenerationEvent } from '@/types/evolution'

// ─── Shared chart style constants ─────────────────────────────────────────────
const TICK_STYLE  = { fill: '#A7B0B7', fontSize: 10, fontFamily: 'IBM Plex Mono' }
const GRID_STROKE = 'rgba(0,240,255,0.06)'
const ACCENT      = '#00F0FF'

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="ces-card px-3 py-2 text-[11px] font-mono space-y-0.5 shadow-glow">
      <p className="text-text-secondary mb-1">Gen {label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toFixed(4)}
        </p>
      ))}
    </div>
  )
}

// ─── Downsample to at most N points so the chart stays crisp ─────────────────
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const step = arr.length / max
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)])
}

// ─── Mini sparkline SVG ───────────────────────────────────────────────────────
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-text-secondary/30 font-mono text-xs">—</span>

  const W = 56, H = 18
  const min   = Math.min(...values)
  const max   = Math.max(...values)
  const range = max - min || 0.001

  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / range) * (H - 2) - 1,
  ])

  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={d} stroke={ACCENT} strokeWidth={1.5} fill="none" strokeOpacity={0.75} strokeLinejoin="round" />
      {/* Terminal dot */}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={ACCENT} opacity={0.9} />
    </svg>
  )
}

// ─── Fitness line chart ───────────────────────────────────────────────────────
function FitnessChart({ generations }: { generations: GenerationEvent[] }) {
  const data = downsample(
    generations.map((g) => ({
      gen: g.generation,
      top: +(g.topFitness * 100).toFixed(3),
      avg: +(g.avgFitness * 100).toFixed(3),
    })),
    120
  )

  if (data.length === 0) return <EmptyChart label="fitness over generations" />

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="gen" tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="top"
          name="Top"
          stroke={ACCENT}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: ACCENT }}
        />
        <Line
          type="monotone"
          dataKey="avg"
          name="Avg"
          stroke="rgba(0,240,255,0.35)"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="5 3"
          activeDot={{ r: 3, fill: 'rgba(0,240,255,0.6)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Mutation operator bar chart ──────────────────────────────────────────────
function MutationChart({ generations }: { generations: GenerationEvent[] }) {
  const acc = { gaussian: 0, uniform: 0, adaptive: 0 }
  generations.forEach((g) => {
    acc.gaussian += g.mutationOperatorFreq.gaussian ?? 0
    acc.uniform  += g.mutationOperatorFreq.uniform  ?? 0
    acc.adaptive += g.mutationOperatorFreq.adaptive ?? 0
  })

  const data = [
    { op: 'GAUSS', count: acc.gaussian },
    { op: 'UNIF',  count: acc.uniform  },
    { op: 'ADPT',  count: acc.adaptive },
  ]

  if (generations.length === 0) return <EmptyChart label="mutation operator frequency" />

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="op" tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar
          dataKey="count"
          name="Uses"
          fill="rgba(0,240,255,0.12)"
          stroke={ACCENT}
          strokeWidth={1}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Agent leaderboard ────────────────────────────────────────────────────────
function AgentLeaderboard({ generations }: { generations: GenerationEvent[] }) {
  if (generations.length === 0) {
    return (
      <div className="flex items-center justify-center h-24">
        <p className="font-mono text-xs text-text-secondary/40">No data yet</p>
      </div>
    )
  }

  // Top 10 generations by fitness, deduplicated to ~0.001 buckets
  const seen = new Set<string>()
  const top10 = [...generations]
    .sort((a, b) => b.topFitness - a.topFitness)
    .filter((g) => {
      const bucket = g.topFitness.toFixed(3)
      if (seen.has(bucket)) return false
      seen.add(bucket)
      return true
    })
    .slice(0, 10)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead className="hidden sm:table-cell">Agent</TableHead>
          <TableHead>Fitness</TableHead>
          <TableHead>Gen</TableHead>
          <TableHead className="hidden sm:table-cell">Op</TableHead>
          <TableHead>Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {top10.map((ev, rank) => {
          const window = generations
            .filter((g) => g.generation <= ev.generation)
            .slice(-8)
            .map((g) => g.topFitness)

          return (
            <TableRow key={ev.bestAgent.id}>
              <TableCell>
                <span className="font-mono text-[12px] text-text-secondary/60">{rank + 1}</span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <span className="font-mono text-[12px] text-text-secondary">
                  {ev.bestAgent.id.slice(0, 12)}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-[12px] text-accent tabular-nums">
                  {ev.topFitness.toFixed(6)}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-[12px] text-text-secondary tabular-nums">
                  {ev.generation}
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {ev.bestAgent.mutationOperator.slice(0, 3).toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <Sparkline values={window} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="font-mono text-xs text-text-secondary/30 italic">{label}</p>
    </div>
  )
}

// ─── MetricsDashboard ─────────────────────────────────────────────────────────
export function MetricsDashboard() {
  const generations = useEvolutionStore(selectGenerations)

  return (
    <div className="grid grid-cols-1 gap-4 h-full">
      {/* Row 1: Fitness chart (wide) + Mutation chart */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Fitness Over Generations</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-px bg-accent block" />
                  <span className="font-mono text-[10px] text-text-secondary">TOP</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-px block"
                    style={{ background: 'rgba(0,240,255,0.35)', backgroundImage: 'repeating-linear-gradient(90deg,rgba(0,240,255,0.35) 0,rgba(0,240,255,0.35) 5px,transparent 5px,transparent 8px)' }}
                  />
                  <span className="font-mono text-[10px] text-text-secondary">AVG</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <FitnessChart generations={generations} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Mutation Ops</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <MutationChart generations={generations} />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Leaderboard */}
      <Card>
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Agent Leaderboard</CardTitle>
            <span className="font-mono text-[10px] text-text-secondary/50">
              top {Math.min(10, generations.length)} agents
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0 overflow-auto">
          <AgentLeaderboard generations={generations} />
        </CardContent>
      </Card>
    </div>
  )
}
