import { useState } from 'react'
import { Play, Pause, RotateCcw, Zap, SlidersHorizontal } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Drawer, DrawerContent, DrawerHeader,
  DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer'
import {
  useEvolutionStore,
  selectStatus,
  selectConfig,
} from '@/store/evolutionStore'
import { useEvolutionActions } from '@/context/evolutionActions'
import type { MutationOperator } from '@/types/evolution'

// ─── Labelled slider row ──────────────────────────────────────────────────────
interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}

function SliderRow({ label, value, min, max, step, format, onChange, disabled }: SliderRowProps) {
  const display = format ? format(value) : String(value)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
          {label}
        </span>
        <span className="font-mono text-xs text-accent tabular-nums">{display}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
    </div>
  )
}

// ─── Status indicator ─────────────────────────────────────────────────────────
function StatusIndicator() {
  const status = useEvolutionStore(selectStatus)

  const variant =
    status === 'EVOLVING'     ? 'evolving'
    : status === 'PAUSED'     ? 'paused'
    : status === 'CONVERGED'  ? 'converged'
    : 'disconnected'

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          status === 'EVOLVING'
            ? 'bg-accent animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]'
            : status === 'PAUSED'
            ? 'bg-yellow-400'
            : status === 'CONVERGED'
            ? 'bg-green-400'
            : 'bg-text-secondary/30'
        }`}
      />
      <Badge variant={variant} className="text-[10px] font-mono tracking-widest">
        {status}
      </Badge>
    </div>
  )
}

// ─── Advanced hyperparameters drawer ─────────────────────────────────────────
function AdvancedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config       = useEvolutionStore(selectConfig)
  const updateConfig = useEvolutionStore((s) => s.updateConfig)
  const status       = useEvolutionStore(selectStatus)
  const isEvolving   = status === 'EVOLVING'

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader>
          <DrawerTitle>Advanced Hyperparameters</DrawerTitle>
          <DrawerDescription className="font-mono text-[11px]">
            Fine-tune the evolutionary algorithm. Changes apply from the next generation.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-8 space-y-6 overflow-y-auto">
          <SliderRow
            label="Crossover Rate"
            value={config.crossoverRate}
            min={0} max={1} step={0.01}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => updateConfig({ crossoverRate: v })}
            disabled={isEvolving}
          />

          <SliderRow
            label="Elitism Count"
            value={config.elitismCount}
            min={0} max={20} step={1}
            format={(v) => String(v)}
            onChange={(v) => updateConfig({ elitismCount: v })}
            disabled={isEvolving}
          />

          <SliderRow
            label="Genome Size"
            value={config.genomeSize}
            min={8} max={128} step={4}
            format={(v) => String(v)}
            onChange={(v) => updateConfig({ genomeSize: v })}
            disabled={isEvolving}
          />

          <SliderRow
            label="Max Generations"
            value={config.maxGenerations}
            min={50} max={5000} step={50}
            format={(v) => String(v)}
            onChange={(v) => updateConfig({ maxGenerations: v })}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                Convergence Threshold
              </span>
              <span className="font-mono text-xs text-accent tabular-nums">
                {config.convergenceThreshold.toExponential(1)}
              </span>
            </div>
            <Slider
              min={0.0001}
              max={0.05}
              step={0.0001}
              value={[config.convergenceThreshold]}
              onValueChange={([v]) => updateConfig({ convergenceThreshold: v })}
            />
          </div>

          {isEvolving && (
            <p className="font-mono text-[10px] text-yellow-400/70 text-center pt-2">
              Some settings locked while evolving
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ─── ControlPanel ─────────────────────────────────────────────────────────────
export function ControlPanel() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const status            = useEvolutionStore(selectStatus)
  const config            = useEvolutionStore(selectConfig)
  const setMutationRate   = useEvolutionStore((s) => s.setMutationRate)
  const setPopulationSize = useEvolutionStore((s) => s.setPopulationSize)
  const setMutationOp     = useEvolutionStore((s) => s.setMutationOperator)

  const { start, pause, reset, injectMutation } = useEvolutionActions()

  const isEvolving   = status === 'EVOLVING'
  const isDisconnected = status === 'DISCONNECTED'
  const isConverged  = status === 'CONVERGED'

  const handleStartPause = () => {
    if (isEvolving) pause()
    else start()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/[0.08]">
        <h2 className="font-heading text-sm font-semibold text-text-primary">Control Panel</h2>
        <StatusIndicator />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

        {/* ── Primary controls ── */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={isEvolving ? 'outline' : 'default'}
            size="sm"
            className="col-span-2"
            onClick={handleStartPause}
            disabled={isConverged}
          >
            {isEvolving ? (
              <><Pause className="h-3.5 w-3.5" /> Pause</>
            ) : (
              <><Play  className="h-3.5 w-3.5" /> {isDisconnected || isConverged ? 'Start' : 'Resume'}</>
            )}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => injectMutation(config.mutationRate * 3)}
            disabled={!isEvolving}
            title="Inject an environmental shock — perturbs the entire population"
          >
            <Zap className="h-3.5 w-3.5 text-accent" /> Shock
          </Button>
        </div>

        <Separator />

        {/* ── Mutation rate ── */}
        <SliderRow
          label="Mutation Rate"
          value={config.mutationRate}
          min={0} max={1} step={0.001}
          format={(v) => `${(v * 100).toFixed(1)}%`}
          onChange={setMutationRate}
        />

        {/* ── Population size ── */}
        <SliderRow
          label="Population Size"
          value={config.populationSize}
          min={10} max={200} step={5}
          format={(v) => String(v)}
          onChange={setPopulationSize}
          disabled={isEvolving}
        />

        <Separator />

        {/* ── Mutation operator ── */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block">
            Mutation Operator
          </span>
          <Select
            value={config.mutationOperator}
            onValueChange={(v) => setMutationOp(v as MutationOperator)}
          >
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gaussian" className="font-mono text-xs">
                Gaussian — N(0, σ) perturbation
              </SelectItem>
              <SelectItem value="uniform" className="font-mono text-xs">
                Uniform — random replacement
              </SelectItem>
              <SelectItem value="adaptive" className="font-mono text-xs">
                Adaptive — rank-scaled sigma
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* ── Live stats ── */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block">
            Current Config
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['Crossover',    `${(config.crossoverRate * 100).toFixed(0)}%`],
              ['Elitism',      String(config.elitismCount)],
              ['Genome',       String(config.genomeSize)],
              ['Max Gens',     String(config.maxGenerations)],
              ['Conv. Thresh', config.convergenceThreshold.toExponential(1)],
              ['Pop × Genome', String(config.populationSize * config.genomeSize)],
            ].map(([k, v]) => (
              <div key={k} className="ces-card px-2 py-1.5">
                <p className="font-mono text-[8px] text-text-secondary/60 uppercase tracking-widest leading-none mb-0.5">
                  {k}
                </p>
                <p className="font-mono text-xs text-text-primary tabular-nums">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Advanced drawer trigger ── */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full border border-accent/[0.08] text-text-secondary hover:text-text-primary"
          onClick={() => setDrawerOpen(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Advanced Hyperparameters
        </Button>
      </div>

      <AdvancedDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
