import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Sheet, SheetContent, SheetHeader,
  SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useEvolutionStore, selectSelectedAgent } from '@/store/evolutionStore'
import type { LayerSpec } from '@/types/evolution'

// ─── Layout constants ─────────────────────────────────────────────────────────
const VB_W        = 580
const VB_H        = 280
const NODE_R      = 11
const NODE_SPACING = 38
const CENTER_Y    = VB_H / 2
const LAYER_XS    = [58, 168, 290, 412, 522] // fixed x per layer index

function nodeY(neuronIdx: number, layerSize: number): number {
  const totalH = (layerSize - 1) * NODE_SPACING
  return CENTER_Y - totalH / 2 + neuronIdx * NODE_SPACING
}

// ─── Edge line length ─────────────────────────────────────────────────────────
function lineLen(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

// ─── Weight → visual properties ──────────────────────────────────────────────
function edgeStyle(weight: number): { stroke: string; strokeWidth: number; opacity: number } {
  const abs = Math.abs(weight)
  const strokeWidth = Math.max(0.4, Math.min(2.8, abs * 2.6))
  const opacity     = Math.max(0.08, Math.min(0.75, abs * 0.9))
  const stroke      = weight >= 0 ? '#00F0FF' : '#FF6B6B'
  return { stroke, strokeWidth, opacity }
}

// ─── Layer type → accent colour ──────────────────────────────────────────────
function layerColor(type: LayerSpec['type']): string {
  switch (type) {
    case 'input':  return '#00F0FF'
    case 'output': return '#A78BFA'
    default:       return '#34D399'
  }
}

// ─── Weight distribution mini-chart ──────────────────────────────────────────
function WeightDistribution({ weights }: { weights: number[][] }) {
  const flat = weights.flat()
  if (flat.length === 0) return <p className="font-mono text-xs text-text-secondary/40">No weights</p>

  const min   = Math.min(...flat)
  const max   = Math.max(...flat)
  const mean  = flat.reduce((s, v) => s + v, 0) / flat.length
  const std   = Math.sqrt(flat.reduce((s, v) => s + (v - mean) ** 2, 0) / flat.length)

  // Build 16-bucket histogram
  const BUCKETS = 16
  const range   = max - min || 0.001
  const counts  = new Array(BUCKETS).fill(0)
  flat.forEach((v) => {
    const b = Math.min(BUCKETS - 1, Math.floor(((v - min) / range) * BUCKETS))
    counts[b]++
  })
  const maxCount = Math.max(...counts)

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Min',  min.toFixed(4)],
          ['Max',  max.toFixed(4)],
          ['Mean', mean.toFixed(4)],
          ['Std',  std.toFixed(4)],
        ].map(([label, val]) => (
          <div key={label} className="ces-card p-2">
            <p className="font-mono text-[9px] text-text-secondary uppercase tracking-widest">{label}</p>
            <p className="font-mono text-sm text-accent">{val}</p>
          </div>
        ))}
      </div>

      {/* Histogram */}
      <div>
        <p className="font-mono text-[10px] text-text-secondary mb-2 uppercase tracking-widest">
          Weight Distribution ({flat.length} values)
        </p>
        <div className="flex items-end gap-0.5 h-16">
          {counts.map((c, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-300"
              style={{
                height:     `${(c / maxCount) * 100}%`,
                background: c > 0 ? 'rgba(0,240,255,0.25)' : 'transparent',
                border:     c > 0 ? '1px solid rgba(0,240,255,0.5)' : 'none',
                boxShadow:  c === maxCount ? '0 0 6px rgba(0,240,255,0.4)' : 'none',
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-mono text-[9px] text-text-secondary/50">{min.toFixed(2)}</span>
          <span className="font-mono text-[9px] text-text-secondary/50">{max.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── SVG graph ────────────────────────────────────────────────────────────────
interface GraphProps {
  layers: LayerSpec[]
  onNodeClick: (layer: LayerSpec) => void
  animKey: number
}

function NeuralGraph({ layers, onNodeClick, animKey }: GraphProps) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Reusable glow filter */}
        <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Edges — keyed so remount re-triggers dash animation */}
      <g key={animKey}>
        {layers.slice(0, -1).map((fromLayer, li) => {
          const toLayer  = layers[li + 1]
          const x1Base   = LAYER_XS[li]
          const x2Base   = LAYER_XS[li + 1]

          return fromLayer.weights.map((toWeights, fi) => {
            const y1 = nodeY(fi, fromLayer.size)
            return toWeights.map((weight, ti) => {
              const y2   = nodeY(ti, toLayer.size)
              const len  = lineLen(x1Base, y1, x2Base, y2)
              const { stroke, strokeWidth, opacity } = edgeStyle(weight)
              const delay = (li * fromLayer.size * toLayer.size + fi * toLayer.size + ti) * 6

              return (
                <line
                  key={`${li}-${fi}-${ti}`}
                  x1={x1Base} y1={y1}
                  x2={x2Base} y2={y2}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeDasharray={len}
                  strokeDashoffset={len}
                  style={{
                    animation: `drawEdge 0.7s ease-out ${delay}ms forwards`,
                  }}
                />
              )
            })
          })
        })}
      </g>

      {/* Layer labels */}
      {layers.map((layer, li) => (
        <text
          key={`lbl-${li}`}
          x={LAYER_XS[li]}
          y={VB_H - 6}
          textAnchor="middle"
          fill="#A7B0B7"
          fontSize={9}
          fontFamily="IBM Plex Mono"
          letterSpacing={1}
        >
          {layer.type.toUpperCase()}
        </text>
      ))}

      {/* Nodes */}
      {layers.map((layer, li) =>
        Array.from({ length: layer.size }, (_, ni) => {
          const cx    = LAYER_XS[li]
          const cy    = nodeY(ni, layer.size)
          const color = layerColor(layer.type)

          return (
            <g
              key={`n-${li}-${ni}`}
              className="cursor-pointer"
              onClick={() => onNodeClick(layer)}
            >
              {/* Outer glow ring */}
              <circle
                cx={cx} cy={cy} r={NODE_R + 4}
                fill="none"
                stroke={color}
                strokeWidth={0.5}
                opacity={0.15}
              />
              {/* Node body */}
              <circle
                cx={cx} cy={cy} r={NODE_R}
                fill="#0E1116"
                stroke={color}
                strokeWidth={1.5}
                filter="url(#node-glow)"
                className="transition-all duration-150 hover:stroke-[2.5]"
                style={{ '--node-color': color } as React.CSSProperties}
              />
              {/* Neuron index label */}
              <text
                x={cx} y={cy + 4}
                textAnchor="middle"
                fill={color}
                fontSize={8}
                fontFamily="IBM Plex Mono"
                opacity={0.85}
              >
                {ni}
              </text>
            </g>
          )
        })
      )}

      {/* Inline keyframe — scoped to this SVG so no global pollution */}
      <style>{`
        @keyframes drawEdge {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  )
}

// ─── ArchitectureExplorer ─────────────────────────────────────────────────────
export function ArchitectureExplorer() {
  const agent = useEvolutionStore(selectSelectedAgent)

  const [selectedLayer, setSelectedLayer] = useState<LayerSpec | null>(null)
  const [sheetOpen, setSheetOpen]         = useState(false)
  const [animKey, setAnimKey]             = useState(0)
  const prevAgentId                       = useRef<string | null>(null)

  // Re-trigger edge animation on new best agent
  useEffect(() => {
    if (agent && agent.id !== prevAgentId.current) {
      prevAgentId.current = agent.id
      setAnimKey((k) => k + 1)
    }
  }, [agent?.id])

  const handleNodeClick = (layer: LayerSpec) => {
    setSelectedLayer(layer)
    setSheetOpen(true)
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
        <div className="w-12 h-12 rounded-full border border-accent/20 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-accent/20" />
        </div>
        <p className="font-mono text-xs text-text-secondary/40">
          Start evolution to visualise the best agent's architecture
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/[0.08]">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-semibold text-text-primary">
            Architecture Explorer
          </h2>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {agent.layers.map((l) => l.size).join('→')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-secondary/50">
            {agent.id}
          </span>
          <span className="font-mono text-[10px] text-accent tabular-nums">
            f={agent.fitness.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-accent/[0.06]">
        {[
          { color: '#00F0FF', label: 'Input' },
          { color: '#34D399', label: 'Hidden' },
          { color: '#A78BFA', label: 'Output' },
          { color: '#FF6B6B', label: 'Neg weight' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.8 }} />
            <span className="font-mono text-[9px] text-text-secondary">{label}</span>
          </div>
        ))}
        <span className="font-mono text-[9px] text-text-secondary/40 ml-auto">
          click node for weights
        </span>
      </div>

      {/* SVG canvas */}
      <div className="flex-1 p-4 min-h-0">
        <NeuralGraph
          layers={agent.layers}
          onNodeClick={handleNodeClick}
          animKey={animKey}
        />
      </div>

      {/* Weight detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          {selectedLayer && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>
                  Layer {selectedLayer.index} —{' '}
                  <span className="capitalize">{selectedLayer.type}</span>
                </SheetTitle>
                <SheetDescription>
                  {selectedLayer.size} neurons · {selectedLayer.activation} activation
                </SheetDescription>
              </SheetHeader>

              {/* Layer metadata */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  ['Type',       selectedLayer.type],
                  ['Activation', selectedLayer.activation],
                  ['Neurons',    String(selectedLayer.size)],
                  ['Out weights', String(selectedLayer.weights[0]?.length ?? 0)],
                ].map(([k, v]) => (
                  <div key={k} className="ces-card p-2">
                    <p className="font-mono text-[9px] text-text-secondary uppercase tracking-widest">{k}</p>
                    <p className="font-mono text-sm text-text-primary capitalize">{v}</p>
                  </div>
                ))}
              </div>

              <WeightDistribution weights={selectedLayer.weights} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
