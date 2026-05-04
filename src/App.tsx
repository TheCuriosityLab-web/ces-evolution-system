import { useEffect, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import {
  BarChart2, GitBranch, Activity, Cpu, Brain, Database,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

import { HeroSection }           from '@/sections/HeroSection'
import { MetricsDashboard }      from '@/sections/MetricsDashboard'
import { ArchitectureExplorer }  from '@/sections/ArchitectureExplorer'
import { EvolutionFeed, EvolutionTicker } from '@/sections/EvolutionFeed'
import { ControlPanel }          from '@/sections/ControlPanel'
import { IntelligencePanel }     from '@/sections/IntelligencePanel'
import { DataUpload }            from '@/sections/DataUpload'
import { EvolutionActionsProvider } from '@/context/evolutionActions'
import { useEvolutionStore, selectGenerations, selectStatus, selectUser } from '@/store/evolutionStore'
import { AuthModal }    from '@/components/AuthModal'
import { PricingModal } from '@/components/PricingModal'
import { supabase }     from '@/lib/supabase'

// ─── Toast watcher ────────────────────────────────────────────────────────────
// Lives inside the provider so it can read the store after evolution starts.
function ToastWatcher() {
  const generations   = useEvolutionStore(selectGenerations)
  const status        = useEvolutionStore(selectStatus)
  const prevStatus    = useRef(status)
  const milestones    = useRef(new Set<string>())

  useEffect(() => {
    const latest = generations[generations.length - 1]
    if (!latest) return

    const { generation, topFitness, converged } = latest

    // Milestone every 25 generations
    if (generation > 0 && generation % 25 === 0) {
      toast.message(`Generation ${generation}`, {
        description: `Peak fitness: ${(topFitness * 100).toFixed(3)}%`,
        duration: 3000,
      })
    }

    // Fitness threshold crossings
    const thresholds = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
    thresholds.forEach((t) => {
      const key = `fit-${t}`
      if (!milestones.current.has(key) && topFitness >= t) {
        milestones.current.add(key)
        toast.success(`Fitness crossed ${(t * 100).toFixed(0)}%`, {
          description: `Gen ${generation} — best: ${topFitness.toFixed(6)}`,
          duration: 4000,
        })
      }
    })

    if (converged) {
      toast.success('Convergence detected', {
        description: `Evolution stabilised at gen ${generation}`,
        duration: 6000,
      })
    }
  }, [generations.length])

  // Status change toasts
  useEffect(() => {
    if (prevStatus.current === status) return
    if (status === 'PAUSED')  toast.message('Evolution paused')
    if (status === 'EVOLVING' && prevStatus.current === 'PAUSED')
      toast.message('Evolution resumed')
    prevStatus.current = status
  }, [status])

  return null
}

// ─── Left sidebar nav ─────────────────────────────────────────────────────────
type TabId = 'metrics' | 'architecture' | 'feed' | 'intelligence' | 'data'

const NAV_ITEMS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'metrics',      icon: BarChart2,  label: 'Metrics'      },
  { id: 'architecture', icon: GitBranch,  label: 'Architecture' },
  { id: 'feed',         icon: Activity,   label: 'Feed'         },
  { id: 'intelligence', icon: Brain,      label: 'Intelligence' },
  { id: 'data',         icon: Database,   label: 'Data'         },
]

function Sidebar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const status = useEvolutionStore(selectStatus)

  return (
    <aside className="flex flex-col w-14 bg-bg-secondary border-r border-accent/[0.08] shrink-0">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center h-14 border-b border-accent/[0.08]">
        <Cpu className="h-5 w-5 text-accent" />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 py-3 flex-1">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onChange(id)}
            className={`
              group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150
              ${active === id
                ? 'bg-accent/10 text-accent shadow-glow border border-accent/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg'
              }
            `}
          >
            <Icon className="h-4 w-4" />
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded bg-bg-secondary border border-accent/20 font-mono text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-glow">
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* Bottom status dot */}
      <div className="flex items-center justify-center h-12 border-t border-accent/[0.08]">
        <div
          className={`h-2 w-2 rounded-full transition-all ${
            status === 'EVOLVING'   ? 'bg-accent animate-pulse shadow-[0_0_6px_rgba(0,240,255,0.7)]'
            : status === 'PAUSED'  ? 'bg-yellow-400'
            : status === 'CONVERGED' ? 'bg-green-400'
            : 'bg-text-secondary/25'
          }`}
        />
      </div>
    </aside>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,   setActiveTab]   = useState<TabId>('metrics')
  const [authOpen,    setAuthOpen]    = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)

  const { setUser, clearUser } = useEvolutionStore()

  useEffect(() => {
    // Hydrate on mount from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ email: session.user.email ?? '', plan: 'free' })
      }
    })

    // Keep store in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email ?? '', plan: 'free' })
      } else {
        clearUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, clearUser])

  return (
    <EvolutionActionsProvider>
      <ToastWatcher />

      <div className="flex flex-col h-screen bg-bg text-text-primary overflow-hidden">

        {/* ── Top bar ── */}
        <header className="flex items-center justify-between px-5 h-11 border-b border-accent/[0.08] shrink-0 bg-bg-secondary">
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-sm tracking-widest text-accent">CES</span>
            <Separator orientation="vertical" className="h-4" />
            <span className="font-heading text-sm text-text-secondary font-normal tracking-wide">
              Evolution System
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GenerationCounter />
            <Separator orientation="vertical" className="h-4" />
            <HeaderAuth onSignIn={() => setAuthOpen(true)} onUpgrade={() => setPricingOpen(true)} />
          </div>
        </header>

        <AuthModal    open={authOpen}    onClose={() => setAuthOpen(false)} />
        <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar */}
          <Sidebar active={activeTab} onChange={setActiveTab} />

          {/* Main area */}
          <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* Hero — always visible */}
            <div className="px-4 pt-4 pb-3 shrink-0">
              <HeroSection />
            </div>

            {/* Tabbed content */}
            <div className="flex-1 min-h-0 px-4 pb-2">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabId)}
                className="flex flex-col h-full"
              >
                <TabsList className="shrink-0 self-start mb-3">
                  <TabsTrigger value="metrics">
                    <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                    Metrics
                  </TabsTrigger>
                  <TabsTrigger value="architecture">
                    <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                    Architecture
                  </TabsTrigger>
                  <TabsTrigger value="feed">
                    <Activity className="h-3.5 w-3.5 mr-1.5" />
                    Feed
                  </TabsTrigger>
                  <TabsTrigger value="intelligence">
                    <Brain className="h-3.5 w-3.5 mr-1.5" />
                    Intelligence
                  </TabsTrigger>
                  <TabsTrigger value="data">
                    <Database className="h-3.5 w-3.5 mr-1.5" />
                    Data
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-accent/[0.08] bg-bg-secondary">
                  <TabsContent value="metrics" className="h-full m-0 p-4 overflow-y-auto">
                    <MetricsDashboard />
                  </TabsContent>

                  <TabsContent value="architecture" className="h-full m-0 overflow-hidden">
                    <ArchitectureExplorer />
                  </TabsContent>

                  <TabsContent value="feed" className="h-full m-0 overflow-hidden">
                    <EvolutionFeed />
                  </TabsContent>

                  <TabsContent value="intelligence" className="h-full m-0 p-4 overflow-y-auto">
                    <IntelligencePanel />
                  </TabsContent>

                  <TabsContent value="data" className="h-full m-0 p-4 overflow-y-auto">
                    <DataUpload />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </main>

          {/* Right panel — ControlPanel always visible */}
          <aside className="w-64 shrink-0 border-l border-accent/[0.08] bg-bg-secondary overflow-hidden">
            <ControlPanel />
          </aside>
        </div>

        {/* ── Bottom ticker bar ── */}
        <footer className="h-9 shrink-0 border-t border-accent/[0.08] bg-bg-secondary overflow-hidden">
          <EvolutionTicker />
        </footer>
      </div>

      {/* Sonner toast container */}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background:  '#0E1116',
            border:      '1px solid rgba(0,240,255,0.15)',
            color:       '#F4F6F8',
            fontFamily:  'IBM Plex Mono, monospace',
            fontSize:    '12px',
            boxShadow:   '0 0 16px rgba(0,240,255,0.12)',
          },
        }}
      />
    </EvolutionActionsProvider>
  )
}

// ─── Header auth controls ─────────────────────────────────────────────────────
function HeaderAuth({ onSignIn, onUpgrade }: { onSignIn: () => void; onUpgrade: () => void }) {
  const user = useEvolutionStore(selectUser)

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded border border-accent/20 text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
      >
        Sign In
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-text-secondary/60 max-w-[120px] truncate">
        {user.email}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5 text-[#00FF88] border-[#00FF88]/30 bg-[#00FF88]/8">
        {user.plan}
      </span>
      {user.plan === 'free' && (
        <button
          onClick={onUpgrade}
          className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded border border-accent/40 text-accent hover:border-accent hover:shadow-glow transition-all"
        >
          Upgrade
        </button>
      )}
    </div>
  )
}

// ─── Small generation counter in top bar ─────────────────────────────────────
function GenerationCounter() {
  const generations = useEvolutionStore(selectGenerations)
  const status      = useEvolutionStore(selectStatus)
  const latest      = generations[generations.length - 1]

  return (
    <div className="flex items-center gap-3">
      {latest && (
        <>
          <span className="font-mono text-[10px] text-text-secondary/50 uppercase tracking-widest">
            Gen
          </span>
          <span className="font-mono text-sm text-accent tabular-nums">
            {String(latest.generation).padStart(5, '0')}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="font-mono text-[10px] text-text-secondary/50 uppercase tracking-widest">
            Fitness
          </span>
          <span className="font-mono text-sm text-text-primary tabular-nums">
            {(latest.topFitness * 100).toFixed(3)}%
          </span>
        </>
      )}
      <Separator orientation="vertical" className="h-4" />
      <span
        className={`font-mono text-[10px] uppercase tracking-widest ${
          status === 'EVOLVING'   ? 'text-accent'
          : status === 'PAUSED'  ? 'text-yellow-400'
          : status === 'CONVERGED' ? 'text-green-400'
          : 'text-text-secondary/40'
        }`}
      >
        {status}
      </span>
    </div>
  )
}
