import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  useEvolutionStore,
  selectGenerations,
  selectStatus,
  selectCurrentGeneration,
  selectBestFitnessEver,
} from '@/store/evolutionStore'
import type { GenerationEvent } from '@/types/evolution'

// ─── Types ────────────────────────────────────────────────────────────────────

type RobotState = 'ELITE' | 'MUTATING' | 'DEAD' | 'NEW' | 'NORMAL'
type ConnType   = 'crossover' | 'mutation' | 'elite'

interface Robot {
  id:       number
  position: [number, number, number]
  fitness:  number
  state:    RobotState
}

interface Conn {
  key:  string
  from: [number, number, number]
  to:   [number, number, number]
  type: ConnType
  born: number          // performance.now() when spawned
}

// ─── Visual config ────────────────────────────────────────────────────────────

const ROBOT_COLORS: Record<RobotState, string> = {
  ELITE:    '#00F0FF',
  MUTATING: '#FFB800',
  DEAD:     '#1A1E2B',
  NEW:      '#00D4EC',
  NORMAL:   '#0088A8',
}

const CONN_COLORS: Record<ConnType, string> = {
  crossover: '#B8A0FF',
  mutation:  '#FFB800',
  elite:     '#00FF88',
}

const CONN_LIFE_MS = 2000

// ─── Deterministic robot positions ───────────────────────────────────────────

function sinHash(v: number): number {
  const x = Math.sin(v * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const POS50: [number, number, number][] = Array.from({ length: 50 }, (_, i) => [
  sinHash(i * 3 + 0) * 20 - 10,   // x: -10 … 10
  sinHash(i * 3 + 1) * 12 - 6,    // y:  -6 …  6
  sinHash(i * 3 + 2) * 8  - 5,    // z:  -5 …  3
])

// ─── Data builders ────────────────────────────────────────────────────────────

function buildRobots(gens: GenerationEvent[], n: number): Robot[] {
  const ev  = gens[gens.length - 1]
  const eN  = Math.ceil(n * 0.08)
  const dN  = Math.ceil(n * 0.12)
  const mN  = ev && ev.delta > 0.002 ? Math.ceil(n * 0.14) : 0
  const nwN = ev && ev.delta > 0     ? Math.ceil(n * 0.09) : 0

  return POS50.slice(0, n).map((pos, i) => {
    const rank    = i / Math.max(1, n - 1)
    const fitness = ev
      ? Math.max(0.02, ev.worstFitness + (ev.topFitness - ev.worstFitness) * (1 - rank))
      : 0.1 + (1 - rank) * 0.5

    let state: RobotState = 'NORMAL'
    if      (i < eN)                 state = 'ELITE'
    else if (i >= n - dN)            state = 'DEAD'
    else if (i < eN + mN)            state = 'MUTATING'
    else if (i < eN + mN + nwN)      state = 'NEW'

    return { id: i, position: pos, fitness, state }
  })
}

function buildConns(ev: GenerationEvent, n: number): Conn[] {
  const now  = performance.now()
  const out: Conn[] = []
  const eN   = Math.ceil(n * 0.08)
  const g    = ev.generation

  // Elite propagation (green)
  for (let i = 0; i < 2; i++) {
    const t = eN + Math.floor(sinHash(g * 7 + i) * (n - eN))
    out.push({ key: `${g}-e${i}`, from: POS50[i % eN], to: POS50[t % n], type: 'elite',     born: now + i * 100 })
  }

  // Mutation (amber)
  if (ev.delta > 0) {
    const cnt = Math.min(5, 1 + Math.floor(ev.delta * 60))
    for (let i = 0; i < cnt; i++) {
      const a = Math.floor(sinHash(g * 13 + i * 3) * n)
      const b = Math.floor(sinHash(g * 17 + i * 5) * n)
      if (a !== b) out.push({ key: `${g}-m${i}`, from: POS50[a], to: POS50[b], type: 'mutation', born: now + 200 + i * 130 })
    }
  }

  // Crossover (purple)
  for (let i = 0; i < 3; i++) {
    const a = Math.floor(sinHash(g * 23 + i * 7)  * (n / 2))
    const b = Math.floor(sinHash(g * 29 + i * 11) * (n / 2)) + Math.floor(n / 2)
    out.push({ key: `${g}-c${i}`, from: POS50[a % n], to: POS50[b % n], type: 'crossover', born: now + 450 + i * 180 })
  }

  return out
}

// ─── Shared geometry (module-level, never recreated) ─────────────────────────

const SPHERE_GEO = new THREE.SphereGeometry(1, 11, 11)
const DOT_GEO    = new THREE.SphereGeometry(1,  7,  7)

// ─── Camera orbit + mouse parallax ───────────────────────────────────────────

function CameraOrbit({ mouse }: { mouse: React.MutableRefObject<[number, number]> }) {
  const { camera } = useThree()
  const angle = useRef(0)

  useFrame((_, dt) => {
    angle.current += dt * 0.10

    const r  = 24
    const tx = Math.sin(angle.current) * r + mouse.current[0] * 1.5
    const ty = 4 + mouse.current[1] * 1.2
    const tz = Math.cos(angle.current) * r

    camera.position.x += (tx - camera.position.x) * 0.025
    camera.position.y += (ty - camera.position.y) * 0.025
    camera.position.z += (tz - camera.position.z) * 0.025
    camera.lookAt(0, 0, 0)
  })

  return null
}

// ─── Robot sphere ─────────────────────────────────────────────────────────────

function RobotNode({ robot }: { robot: Robot }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const growRef = useRef(robot.state === 'NEW' ? 0.15 : 1)
  const prevSt  = useRef<RobotState>(robot.state)

  useFrame(({ clock }) => {
    if (!meshRef.current) return

    if (robot.state === 'NEW' && prevSt.current !== 'NEW') growRef.current = 0.15
    prevSt.current = robot.state

    if (robot.state === 'NEW') growRef.current = Math.min(1, growRef.current + 0.022)

    const base = 0.1 + robot.fitness * 0.32
    let s = growRef.current * base
    if (robot.state === 'ELITE') s *= 1 + Math.sin(clock.elapsedTime * 2.5 + robot.id * 0.7) * 0.15

    meshRef.current.scale.setScalar(s)
  })

  const base  = 0.1 + robot.fitness * 0.32
  const initS = (robot.state === 'NEW' ? 0.15 : 1) * base
  const isDead = robot.state === 'DEAD'

  return (
    <mesh ref={meshRef} position={robot.position} scale={initS}>
      <primitive object={SPHERE_GEO} attach="geometry" />
      <meshStandardMaterial
        color={ROBOT_COLORS[robot.state]}
        emissive={ROBOT_COLORS[robot.state]}
        emissiveIntensity={isDead ? 0 : robot.state === 'ELITE' ? 3.5 : 1.6}
        roughness={0.15}
        metalness={0.55}
        transparent={isDead}
        opacity={isDead ? 0.28 : 1}
      />
    </mesh>
  )
}

// ─── Connection line + traveling dot ─────────────────────────────────────────

function ConnLine({ conn }: { conn: Conn }) {
  const { from, to, type, born } = conn
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef   = useRef<any>(null)
  const dotRef    = useRef<THREE.Mesh>(null)
  const dotMatRef = useRef<THREE.MeshStandardMaterial>(null)

  const fromV = useMemo(() => new THREE.Vector3(from[0], from[1], from[2]), [])
  const toV   = useMemo(() => new THREE.Vector3(to[0],   to[1],   to[2]),   [])
  const tmp   = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const age = performance.now() - born
    if (age < 0) return

    const t  = Math.min(1, age / CONN_LIFE_MS)
    const op = Math.max(0,
      t < 0.12 ? t / 0.12
      : t < 0.72 ? 1
      : 1 - (t - 0.72) / 0.28
    ) * 0.7

    if (lineRef.current?.material) {
      lineRef.current.material.opacity = op
    }

    if (dotRef.current && dotMatRef.current) {
      tmp.lerpVectors(fromV, toV, Math.min(1, t * 1.4))
      dotRef.current.position.copy(tmp)
      dotMatRef.current.opacity = Math.min(1, op * 1.3)
    }
  })

  return (
    <>
      <Line
        ref={lineRef}
        points={[from, to]}
        color={CONN_COLORS[type]}
        lineWidth={type === 'elite' ? 1.8 : 1.2}
        transparent
        opacity={0}
      />
      <mesh ref={dotRef} position={from} scale={0.09}>
        <primitive object={DOT_GEO} attach="geometry" />
        <meshStandardMaterial
          ref={dotMatRef}
          color={CONN_COLORS[type]}
          emissive={CONN_COLORS[type]}
          emissiveIntensity={4}
          transparent
          opacity={0}
        />
      </mesh>
    </>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({ mouse, n }: {
  mouse: React.MutableRefObject<[number, number]>
  n: number
}) {
  const generations = useEvolutionStore(selectGenerations)
  const [conns, setConns] = useState<Conn[]>([])
  const prevLen = useRef(0)

  const robots = useMemo(() => buildRobots(generations, n), [generations, n])

  useEffect(() => {
    if (generations.length <= prevLen.current) return
    const latest = generations[generations.length - 1]
    prevLen.current = generations.length

    const fresh = buildConns(latest, n)
    const now   = performance.now()

    setConns(prev => [
      ...prev.filter(c => now - c.born < CONN_LIFE_MS),
      ...fresh,
    ].slice(-18))
  }, [generations.length, n])

  return (
    <>
      <color attach="background" args={['#07080A']} />
      <ambientLight intensity={0.06} />
      <pointLight position={[0,  6, 10]} intensity={1.0} color="#00F0FF" decay={2} />
      <pointLight position={[0, -4, -8]} intensity={0.3} color="#8060FF" decay={2} />

      <CameraOrbit mouse={mouse} />

      {robots.map((r, i) => <RobotNode key={i} robot={r} />)}
      {conns.map(c => <ConnLine key={c.key} conn={c} />)}

      <EffectComposer>
        <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.85} intensity={2.8} height={256} />
      </EffectComposer>
    </>
  )
}

// ─── Robot count hook (20 on mobile, 50 on desktop) ──────────────────────────

function useRobotCount() {
  const [n, setN] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 50
  )
  useEffect(() => {
    const upd = () => setN(window.innerWidth < 768 ? 20 : 50)
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [])
  return n
}

// ─── HeroSection (export) ─────────────────────────────────────────────────────

export function HeroSection() {
  const status     = useEvolutionStore(selectStatus)
  const generation = useEvolutionStore(selectCurrentGeneration)
  const bestEver   = useEvolutionStore(selectBestFitnessEver)
  const robotCount = useRobotCount()
  const mouse      = useRef<[number, number]>([0, 0])

  return (
    <div
      className="relative w-full h-[280px] rounded-xl overflow-hidden border border-accent/[0.08]"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mouse.current = [
          ((e.clientX - r.left) / r.width  - 0.5) * 2,
          -((e.clientY - r.top) / r.height - 0.5) * 2,
        ]
      }}
      onMouseLeave={() => { mouse.current = [0, 0] }}
    >
      {/* 3D canvas fills the hero */}
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        camera={{ position: [0, 4, 24], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false }}
      >
        <Scene mouse={mouse} n={robotCount} />
      </Canvas>

      {/* Overlay — text on top of 3D scene */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>

        {/* Top-left label */}
        <p className="absolute top-3 left-4 font-mono text-[10px] tracking-[0.25em] text-accent/60 uppercase">
          CES // Evolution System
        </p>

        {/* Top-right status */}
        <div className="absolute top-3 right-4 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${
            status === 'EVOLVING' ? 'bg-accent animate-pulse shadow-[0_0_6px_rgba(0,240,255,0.7)]' : 'bg-text-secondary/40'
          }`} />
          <span className="font-mono text-[10px] tracking-widest text-text-secondary uppercase">
            {status}
          </span>
        </div>

        {/* Center: heading + stats */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h1
            className="font-heading font-bold tracking-[0.18em]"
            style={{
              fontSize: 'clamp(26px, 7.5vw, 60px)',
              color: 'rgba(244,246,248,0.92)',
              textShadow: '0 0 32px rgba(0,240,255,0.35), 0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            COGNITO ERGO SUM
          </h1>

          <div className="mt-3 grid grid-cols-2 md:flex md:items-center gap-3 md:gap-6">
            <div className="flex flex-col items-center">
              <span className="font-mono text-[9px] text-text-secondary/70 uppercase tracking-widest">
                Generation
              </span>
              <span
                className="font-mono text-lg md:text-2xl font-semibold tabular-nums"
                style={{ color: '#00F0FF', textShadow: '0 0 10px rgba(0,240,255,0.6)' }}
              >
                {String(generation).padStart(5, '0')}
              </span>
            </div>

            <div className="hidden md:block h-8 w-px bg-accent/20" />

            <div className="flex flex-col items-center">
              <span className="font-mono text-[9px] text-text-secondary/70 uppercase tracking-widest">
                Peak Fitness
              </span>
              <span className="font-mono text-lg md:text-2xl font-semibold text-text-primary tabular-nums">
                {(bestEver * 100).toFixed(4)}
                <span className="text-sm text-text-secondary">%</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom fitness bar */}
        <div className="absolute bottom-4 left-6 right-6">
          <div className="h-px bg-accent/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-700 rounded-full"
              style={{ width: `${bestEver * 100}%`, boxShadow: '0 0 8px rgba(0,240,255,0.6)' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[9px] text-text-secondary/40">0%</span>
            <span className="font-mono text-[9px] text-accent/50">FITNESS LANDSCAPE</span>
            <span className="font-mono text-[9px] text-text-secondary/40">100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
