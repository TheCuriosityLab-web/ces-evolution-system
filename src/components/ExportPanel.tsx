import { useState } from 'react'
import { FileText, Table, Braces, Camera, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  useEvolutionStore,
  selectGenerations,
  selectConfig,
  selectSelectedAgent,
  selectBestFitnessEver,
  selectCurrentGeneration,
} from '@/store/evolutionStore'

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

interface ExportPanelProps {
  open: boolean
  onClose: () => void
}

type ExportKey = 'pdf' | 'csv' | 'json' | 'png'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fmtBytes(n: number) {
  if (n < 1024)       return `~${n} B`
  if (n < 1024 * 1024) return `~${(n / 1024).toFixed(1)} KB`
  return `~${(n / 1024 / 1024).toFixed(1)} MB`
}

export function ExportPanel({ open, onClose }: ExportPanelProps) {
  const generations = useEvolutionStore(selectGenerations)
  const config      = useEvolutionStore(selectConfig)
  const agent       = useEvolutionStore(selectSelectedAgent)
  const bestEver    = useEvolutionStore(selectBestFitnessEver)
  const generation  = useEvolutionStore(selectCurrentGeneration)

  const [loading, setLoading] = useState<ExportKey | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const run = async (key: ExportKey, fn: () => Promise<void>) => {
    setLoading(key)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(null)
    }
  }

  // ── CSV ──────────────────────────────────────────────────────────────────────
  const exportCSV = () => run('csv', async () => {
    const header = 'generation,timestamp,topFitness,avgFitness,worstFitness,delta,mutationRate,populationSize'
    const rows   = generations.map((g) =>
      [g.generation, g.timestamp, g.topFitness, g.avgFitness, g.worstFitness,
       g.delta, g.mutationRate, g.populationSize].join(',')
    )
    const csv  = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    triggerDownload(blob, 'ces-evolution-results.csv')
  })

  // ── JSON ─────────────────────────────────────────────────────────────────────
  const exportJSON = () => run('json', async () => {
    const payload = {
      exportedAt:  new Date().toISOString(),
      config,
      bestFitness: bestEver,
      generations: generation,
      bestAgent:   agent,
      history:     generations,
    }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    triggerDownload(blob, 'ces-evolution-data.json')
  })

  // ── PNG screenshot ────────────────────────────────────────────────────────────
  const exportPNG = () => run('png', async () => {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(document.body, { scale: 1.5, useCORS: true })
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, 'ces-evolution-screenshot.png')
    }, 'image/png')
  })

  // ── PDF ──────────────────────────────────────────────────────────────────────
  const exportPDF = () => run('pdf', async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const now  = new Date().toLocaleString()
    const w    = doc.internal.pageSize.getWidth()

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(0, 240, 255)
    doc.text('CES Evolution System Report', w / 2, 20, { align: 'center' })

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130, 140, 150)
    doc.text(`Generated: ${now}`, w / 2, 27, { align: 'center' })

    // Summary block
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const summary = [
      `Generations run:       ${generation}`,
      `Best fitness achieved: ${(bestEver * 100).toFixed(4)}%`,
      `Population size:       ${config.populationSize}`,
      `Genome size:           ${config.genomeSize}`,
      `Mutation rate:         ${(config.mutationRate * 100).toFixed(1)}%`,
      `Crossover rate:        ${(config.crossoverRate * 100).toFixed(1)}%`,
      `Elitism count:         ${config.elitismCount}`,
      `Mutation operator:     ${config.mutationOperator}`,
    ]
    summary.forEach((line, i) => doc.text(line, 14, 45 + i * 6))

    // Top generations table
    const topGens = [...generations]
      .sort((a, b) => b.topFitness - a.topFitness)
      .slice(0, 10)

    autoTable(doc, {
      startY: 100,
      head: [['Rank', 'Generation', 'Top Fitness', 'Avg Fitness', 'Delta']],
      body: topGens.map((g, i) => [
        i + 1,
        g.generation,
        (g.topFitness * 100).toFixed(4) + '%',
        (g.avgFitness * 100).toFixed(4) + '%',
        (g.delta >= 0 ? '+' : '') + (g.delta * 100).toFixed(5) + '%',
      ]),
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [0, 240, 255], textColor: [7, 8, 10] },
    })

    // Plain English summary
    const afterTable = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 160
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('What Happened', 14, afterTable + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const phase = generation > 100 ? 'fine-tuning' : generation > 20 ? 'pattern discovery' : 'exploration'
    const summary2 = doc.splitTextToSize(
      `The AI ran for ${generation} generation${generation !== 1 ? 's' : ''}, testing ${
        generations.reduce((s, g) => s + g.populationSize, 0).toLocaleString()
      } different solutions in total. It reached a peak fitness of ${(bestEver * 100).toFixed(2)}% ` +
      `during the ${phase} phase. Each generation kept the top ${config.elitismCount} agents ` +
      `and created new variations through crossover and mutation.`,
      w - 28
    )
    doc.text(summary2, 14, afterTable + 17)

    doc.save('ces-evolution-report.pdf')
  })

  // ── Size estimates ────────────────────────────────────────────────────────────
  const csvSize  = fmtBytes(generations.length * 80)
  const jsonSize = fmtBytes(JSON.stringify({ generations, config, agent }).length)
  const pngSize  = '~2–4 MB'
  const pdfSize  = '~50–200 KB'

  const cards: {
    key:   ExportKey
    icon:  React.ElementType
    title: string
    desc:  string
    size:  string
    fn:    () => void
  }[] = [
    {
      key:   'pdf',
      icon:  FileText,
      title: 'PDF Report',
      desc:  'Full report with summary, top agents table, config, and plain-English explanation.',
      size:  pdfSize,
      fn:    exportPDF,
    },
    {
      key:   'csv',
      icon:  Table,
      title: 'CSV Data',
      desc:  'Raw generation data: fitness, mutation rate, population size per generation.',
      size:  csvSize,
      fn:    exportCSV,
    },
    {
      key:   'json',
      icon:  Braces,
      title: 'JSON Dump',
      desc:  'Complete data: all GenerationEvents, config, best agent genome, fitness history.',
      size:  jsonSize,
      fn:    exportJSON,
    },
    {
      key:   'png',
      icon:  Camera,
      title: 'PNG Screenshot',
      desc:  'Capture the entire dashboard as a high-resolution image.',
      size:  pngSize,
      fn:    exportPNG,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" style={{ background: '#0E1116' }}>
        <DialogHeader>
          <DialogTitle
            className="text-[10px] tracking-widest uppercase"
            style={{ color: '#A7B0B7', ...MONO }}
          >
            Export Results
          </DialogTitle>
          <p className="text-[11px] text-[#A7B0B7]/60" style={MONO}>
            {generations.length > 0
              ? `${generation} generations of data ready to export`
              : 'No data yet — run evolution first'}
          </p>
        </DialogHeader>

        {error && (
          <p
            className="text-[11px] px-3 py-2 rounded"
            style={{
              background: 'rgba(255,60,60,0.10)',
              color:      '#FF6B6B',
              border:     '1px solid rgba(255,60,60,0.25)',
              ...MONO,
            }}
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ key, icon: Icon, title, desc, size, fn }) => (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-lg p-4"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border:     '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#00F0FF]" />
                <span className="text-[12px] font-bold text-white" style={MONO}>{title}</span>
              </div>

              <p className="text-[11px] text-[#A7B0B7] leading-relaxed flex-1" style={MONO}>
                {desc}
              </p>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-[10px] text-[#A7B0B7]/50" style={MONO}>{size}</span>
                <button
                  onClick={fn}
                  disabled={loading !== null || generations.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:  loading === key ? 'rgba(0,240,255,0.08)' : '#00F0FF',
                    color:       loading === key ? '#00F0FF'               : '#07080A',
                    border:      loading === key ? '1px solid #00F0FF'     : 'none',
                    ...MONO,
                  }}
                >
                  {loading === key ? (
                    <>
                      <span className="animate-spin inline-block h-3 w-3 border border-current border-t-transparent rounded-full" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
                      Download
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
