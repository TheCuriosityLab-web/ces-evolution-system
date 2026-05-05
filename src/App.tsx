import { useEffect, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import {
  BarChart2, GitBranch, Activity, Cpu, Brain, Database, BookOpen, Download,
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
import { LearningStory }         from '@/sections/LearningStory'
import { EvolutionActionsProvider } from '@/context/evolutionActions'
import { useEvolutionStore, selectGenerations, selectStatus, selectUser } from '@/store/evolutionStore'
import { AuthModal }   from '@/components/AuthModal'
import { ExportPanel } from '@/components/ExportPanel'
import { supabase }     from '@/lib/supabase'

// ─── Toast watcher ────────────────────────────────────────────────────────────
function ToastWatcher() {
  const generations = useEvolutionStore(selectGenerations)
  const status      = useEvolutionStore(selectStatus)
  const prevStatus  = useRef(status)
  const milestones  = useRef(new Set<string>())

  useEffect(() => {
    const latest = generations[generations.length - 1]
    if (!latest) return
    const { generation, topFitness, converged } = latest

    if (generation > 0 && generation % 25 === 0) {
      toast.message(`Generation ${generation}`, {
        description: `Peak fitness: ${(topFitness * 100).toFixed(3)}%`,
        duration: 3000,
      })
    }

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

  useEffect(() => {
    if (prevStatus.current === status) return
    if (status === 'PAUSED') toast.message('Evolution paused')
    if (status === 'EVOLVING' && prevStatus.current === 'PAUSED')
      toast.message('Evolution resumed')
    prevStatus.current = status
  }, [status])

  return null
}

// ─── Nav items shared between sidebar and mobile nav ─────────────────────────
type TabId = 'metrics' | 'architecture' | 'feed' | 'intelligence' | 'data' | 'story'

const NAV_ITEMS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'metrics',      icon: BarChart2, label: 'Metrics'      },
  { id: 'architecture', icon: GitBranch, label: 'Architecture' },
  { id: 'feed',         icon: Activity,  label: 'Feed'         },
  { id: 'intelligence', icon: Brain,     label: 'Intelligence' },
  { id: 'data',         icon: Database,  label: 'Data'         },
  { id: 'story',        icon: BookOpen,  label: 'Story'        },
]

// ─── Desktop left sidebar ─────────────────────────────────────────────────────
function Sidebar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const status = useEvolutionStore(selectStatus)

  return (
    <aside className="hidden md:flex flex-col w-14 bg-bg-secondary border-r border-accent/[0.08] shrink-0">
      <div className="flex flex-col items-center justify-center h-14 border-b border-accent/[0.08]">
        <Cpu className="h-5 w-5 text-accent" />
      </div>

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
            <span className="absolute left-full ml-2 px-2 py-1 rounded bg-bg-secondary border border-accent/20 font-mono text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-glow">
              {label}
            </span>
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-center h-12 border-t border-accent/[0.08]">
        <div
          className={`h-2 w-2 rounded-full transition-all ${
            status === 'EVOLVING'    ? 'bg-accent animate-pulse shadow-[0_0_6px_rgba(0,240,255,0.7)]'
            : status === 'PAUSED'   ? 'bg-yellow-400'
            : status === 'CONVERGED'? 'bg-green-400'
            : 'bg-text-secondary/25'
          }`}
        />
      </div>
    </aside>
  )
}

// ─── Mobile horizontal tab bar ───────────────────────────────────────────────
function MobileTabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div
      className="md:hidden shrink-0"
      style={{ background: '#0E1116', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              padding: '10px 16px',
              color: active === id ? '#00F0FF' : '#A7B0B7',
              borderBottom: `2px solid ${active === id ? '#00F0FF' : 'transparent'}`,
              background: 'transparent',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Mobile status dot (header) ───────────────────────────────────────────────
function MobileStatusDot() {
  const status = useEvolutionStore(selectStatus)
  return (
    <span
      className={`md:hidden h-2 w-2 rounded-full shrink-0 ${
        status === 'EVOLVING'    ? 'bg-accent animate-pulse shadow-[0_0_6px_rgba(0,240,255,0.7)]'
        : status === 'PAUSED'   ? 'bg-yellow-400'
        : status === 'CONVERGED'? 'bg-green-400'
        : 'bg-text-secondary/25'
      }`}
    />
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,  setActiveTab]  = useState<TabId>('metrics')
  const [authOpen,   setAuthOpen]   = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const { setUser, clearUser } = useEvolutionStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ email: session.user.email ?? '', plan: 'free' })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser({ email: session.user.email ?? '', plan: 'free' })
      else clearUser()
    })

    return () => subscription.unsubscribe()
  }, [setUser, clearUser])

  return (
    <EvolutionActionsProvider>
      <ToastWatcher />

      <div className="flex flex-col h-screen bg-bg text-text-primary overflow-hidden">

        {/* ── Top bar ── */}
        <header className="flex items-center justify-between px-3 md:px-5 h-12 md:h-11 border-b border-accent/[0.08] shrink-0 bg-bg-secondary">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="font-heading font-bold text-sm tracking-widest text-accent">CES</span>
            <Separator orientation="vertical" className="h-4 hidden md:block" />
            <span className="font-heading text-sm text-text-secondary font-normal tracking-wide hidden md:inline">
              Evolution System
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Gen + fitness counter — desktop only */}
            <div className="hidden md:flex items-center gap-2">
              <GenerationCounter />
              <Separator orientation="vertical" className="h-4" />
            </div>
            {/* Status dot — mobile only */}
            <MobileStatusDot />
            <button
              onClick={() => setExportOpen(true)}
              title="Export results"
              className="flex items-center justify-center w-7 h-7 rounded border border-accent/20 text-text-secondary hover:border-accent/50 hover:text-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <HeaderAuth onSignIn={() => setAuthOpen(true)} />
          </div>
        </header>

        <AuthModal   open={authOpen}   onClose={() => setAuthOpen(false)} />
        <ExportPanel open={exportOpen} onClose={() => setExportOpen(false)} />

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar — desktop only */}
          <Sidebar active={activeTab} onChange={setActiveTab} />

          {/* Main area — scrolls on mobile, clips on desktop */}
          <main className="flex flex-col flex-1 min-w-0 overflow-y-auto md:overflow-hidden">

            {/* Mobile horizontal tab bar — sits above hero, hidden on desktop */}
            <MobileTabBar active={activeTab} onChange={setActiveTab} />

            {/* Hero */}
            <div className="px-3 md:px-4 pt-3 md:pt-4 pb-2 md:pb-3 shrink-0">
              <HeroSection />
            </div>

            {/* Tabbed content */}
            <div className="min-h-0 md:flex-1 px-3 md:px-4 pb-2">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabId)}
                className="flex flex-col md:h-full"
              >
                {/* Desktop tab bar — hidden on mobile (MobileTabBar handles it) */}
                <div className="hidden md:block overflow-x-auto mb-3 pb-px">
                  <TabsList className="flex w-max md:w-auto shrink-0">
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
                    <TabsTrigger value="story">
                      <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                      Story
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab content — min-height on mobile, fills container on desktop */}
                <div className="min-h-[480px] md:flex-1 md:min-h-0 overflow-y-auto md:overflow-hidden rounded-xl border border-accent/[0.08] bg-bg-secondary">
                  <TabsContent value="metrics" className="min-h-[480px] md:h-full m-0 p-3 md:p-4 overflow-y-auto">
                    <MetricsDashboard />
                  </TabsContent>

                  <TabsContent value="architecture" className="min-h-[480px] md:h-full m-0 overflow-hidden">
                    <ArchitectureExplorer />
                  </TabsContent>

                  <TabsContent value="feed" className="min-h-[480px] md:h-full m-0 overflow-hidden">
                    <EvolutionFeed />
                  </TabsContent>

                  <TabsContent value="intelligence" className="min-h-[480px] md:h-full m-0 p-3 md:p-4 overflow-y-auto">
                    <IntelligencePanel />
                  </TabsContent>

                  <TabsContent value="data" className="min-h-[480px] md:h-full m-0 p-3 md:p-4 overflow-y-auto">
                    <DataUpload />
                  </TabsContent>

                  <TabsContent value="story" className="min-h-[480px] md:h-full m-0 p-3 md:p-4 overflow-y-auto">
                    <LearningStory />
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Control panel — mobile only, stacked below tabs */}
            <div className="md:hidden shrink-0 border-t border-accent/[0.08] bg-bg-secondary max-h-72 overflow-y-auto">
              <ControlPanel />
            </div>

          </main>

          {/* Right panel — desktop only */}
          <aside className="hidden md:flex w-64 shrink-0 flex-col border-l border-accent/[0.08] bg-bg-secondary overflow-hidden">
            <ControlPanel />
          </aside>
        </div>

        {/* ── Desktop ticker bar ── */}
        <footer className="hidden md:flex h-9 shrink-0 border-t border-accent/[0.08] bg-bg-secondary overflow-hidden items-center">
          <EvolutionTicker />
        </footer>


      </div>

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
function HeaderAuth({ onSignIn }: { onSignIn: () => void }) {
  const user = useEvolutionStore(selectUser)

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="font-mono text-[10px] uppercase tracking-widest px-2 md:px-3 py-1 rounded border border-accent/20 text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
      >
        Sign In
      </button>
    )
  }

  return (
    <span className="font-mono text-[10px] text-text-secondary/60 max-w-[140px] truncate hidden md:inline">
      {user.email}
    </span>
  )
}

// ─── Generation counter (desktop top bar) ────────────────────────────────────
function GenerationCounter() {
  const generations = useEvolutionStore(selectGenerations)
  const status      = useEvolutionStore(selectStatus)
  const latest      = generations[generations.length - 1]

  return (
    <div className="flex items-center gap-3">
      {latest && (
        <>
          <span className="font-mono text-[10px] text-text-secondary/50 uppercase tracking-widest">Gen</span>
          <span className="font-mono text-sm text-accent tabular-nums">
            {String(latest.generation).padStart(5, '0')}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="font-mono text-[10px] text-text-secondary/50 uppercase tracking-widest">Fitness</span>
          <span className="font-mono text-sm text-text-primary tabular-nums">
            {(latest.topFitness * 100).toFixed(3)}%
          </span>
        </>
      )}
      <Separator orientation="vertical" className="h-4" />
      <span
        className={`font-mono text-[10px] uppercase tracking-widest ${
          status === 'EVOLVING'    ? 'text-accent'
          : status === 'PAUSED'   ? 'text-yellow-400'
          : status === 'CONVERGED'? 'text-green-400'
          : 'text-text-secondary/40'
        }`}
      >
        {status}
      </span>
    </div>
  )
}
