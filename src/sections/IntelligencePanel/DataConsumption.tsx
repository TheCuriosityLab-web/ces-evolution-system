import { useMemo } from 'react'
import { useEvolutionStore, selectGenerations, selectConfig } from '@/store/evolutionStore'
import { ScrollArea } from '@/components/ui/scroll-area'

function diversityLabel(avgDelta: number): string {
  if (avgDelta < 0.001) return 'COLLAPSED'
  if (avgDelta < 0.01)  return 'LOW'
  return 'HEALTHY'
}

export function DataConsumption() {
  const generations = useEvolutionStore(selectGenerations)
  const config      = useEvolutionStore(selectConfig)

  const stats = useMemo(() => {
    const genCount    = generations.length
    const popSize     = config.populationSize
    const genomeSize  = config.genomeSize

    const totalEval   = genCount * popSize
    const totalWeight = totalEval * genomeSize

    // Throughput: evaluations / elapsed seconds
    let fitnessCallsPerSec = 0
    if (genCount >= 2) {
      const first = generations[0].timestamp
      const last  = generations[genCount - 1].timestamp
      const elapsedSec = (last - first) / 1000
      if (elapsedSec > 0) fitnessCallsPerSec = Math.round(totalEval / elapsedSec)
    }

    // Selection pressure: topFitness / avgFitness of latest gen
    let selectionPressure = 1
    const latest = generations[genCount - 1]
    if (latest && latest.avgFitness > 0) {
      selectionPressure = latest.topFitness / latest.avgFitness
    }

    // Diversity: avg |delta| over last 10 gens
    const window = generations.slice(-10)
    const avgDelta = window.length > 1
      ? window.reduce((s, g) => s + Math.abs(g.delta), 0) / window.length
      : 0

    return {
      genCount,
      popSize,
      genomeSize,
      totalEval,
      totalWeight,
      fitnessCallsPerSec,
      selectionPressure,
      avgDelta,
      diversity: diversityLabel(avgDelta),
      mutOp: config.mutationOperator,
      mutRate: config.mutationRate,
      elitism: config.elitismCount,
    }
  }, [generations, config])

  type Row = { label: string; value: string; accent?: boolean }

  const rows: Row[] = [
    { label: 'FITNESS FUNCTION',        value: 'f(x) = Σ sin(g[i] × π × i) / n',                         accent: true },
    { label: 'INPUT DATA',              value: `${stats.genomeSize} weights per agent` },
    { label: 'SELECTION METHOD',        value: `Tournament + Elitism, top ${stats.elitism} carried forward` },
    { label: 'TOTAL EVALUATIONS',       value: stats.totalEval.toLocaleString(),                           accent: true },
    { label: 'WEIGHT VALUES PROCESSED', value: stats.totalWeight.toLocaleString(),                         accent: true },
    { label: 'THROUGHPUT',              value: `${stats.fitnessCallsPerSec.toLocaleString()} eval/s` },
    { label: 'SELECTION PRESSURE',      value: stats.selectionPressure.toFixed(4) },
    {
      label: 'POPULATION DIVERSITY',
      value: `${stats.diversity}  (Δ̄=${stats.avgDelta.toFixed(5)}, last 10 gens)`,
      accent: stats.diversity === 'HEALTHY',
    },
    { label: 'MUTATION OPERATOR',       value: `${stats.mutOp.toUpperCase()}  rate=${stats.mutRate.toFixed(4)}` },
  ]

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {generations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[11px] text-[#A7B0B7]">
          No data yet — start evolution to collect stats.
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <table className="w-full text-[11px] border-collapse pr-3">
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{ background: i % 2 === 0 ? 'rgba(0,240,255,0.03)' : 'transparent' }}
                >
                  <td
                    className="py-2 px-3 text-[#A7B0B7] tracking-wider whitespace-nowrap w-1/2 align-top"
                    style={{ fontSize: '10px' }}
                  >
                    {row.label}
                  </td>
                  <td
                    className="py-2 px-3 text-right align-top tabular-nums"
                    style={{ color: row.accent ? '#00F0FF' : '#F4F6F8' }}
                  >
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  )
}
