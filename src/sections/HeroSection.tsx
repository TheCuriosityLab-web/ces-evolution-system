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
  born: number
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

// ─── Deterministic base positions (50 robots, full-spread) ───────────────────

function sinHash(v: number): number {
  const x = Math.sin(v * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Base positions span x(-10,10) y(-6,6) z(-5,3) — scaled for mobile
const POS50: [number, number, number][] = Array.from({ length: 50 }, (_, i) => [
  sinHash(i * 3 + 0) * 20 - 10,
  sinHash(i * 3 + 1) * 12 - 6,
  sinHash(i * 3 + 2) * 8  - 5,
])

// ─── Data builders ────────────────────────────────────────────────────────────

function buildRobots(
  gens: GenerationEvent[],
  n: number,
  positions: [number, number, number][],
): Robot[] {
  const ev  = gens[gens.length - 1]
  const eN  = Math.ceil(n * 0.08)
  const dN  = Math.ceil(n * 0.12)
  const mN  = ev && ev.delta > 0.002 ? Math.ceil(n * 0.14) : 0
  const nwN = ev && ev.delta > 0     ? Math.ceil(n * 0.09) : 0

  return positions.slice(0, n).map((pos, i) => {
    const rank    = i / Math.max(1, n - 1)
    const fitness = ev
      ? Math.max(0.02, ev.worstFitness + (ev.topFitness - ev.worstFitness) * (1 - rank))
      : 0.1 + (1 - rank) * 0.5

    let state: RobotState = 'NORMAL'
    if      (i < eN)            state = 'ELITE'
    else if (i >= n - dN)       state = 'DEAD'
    else if (i < eN + mN)       state = 'MUTATING'
    else if (i < eN + mN + nwN) state = 'NEW'

    return { id: i, position: pos, fitness, state }
  })
}

function buildConns(
  ev: GenerationEvent,
  positions: [number, number, number][],
  n: number,
): Conn[] {
  const now = performance.now()
  const out: Conn[] = []
  const eN  = Math.ceil(n * 0.08)
  const g   = ev.generation

  for (let i = 0; i < 2; i++) {
    const t = eN + Math.floor(sinHash(g * 7 + i) * (n - eN))
    out.push({ key: `${g}-e${i}`, from: positions[i % eN], to: positions[t % n], type: 'elite',     born: now + i * 100 })
  }

  if (ev.delta > 0) {
    const cnt = Math.min(5, 1 + Math.floor(ev.delta * 60))
    for (let i = 0; i < cnt; i++) {
      const a = Math.floor(sinHash(g * 13 + i * 3) * n)
      const b = Math.floor(sinHash(g * 17 + i * 5) * n)
      if (a !== b) out.push({ key: `${g}-m${i}`, from: positions[a], to: positions[b], type: 'mutation',  born: now + 200 + i * 130 })
    }
  }

  for (let i = 0; i < 3; i++) {
    const a = Math.floor(sinHash(g * 23 + i * 7)  * (n / 2))
    const b = Math.floor(sinHash(g * 29 + i * 11) * (n / 2)) + Math.floor(n / 2)
    out.push({ key: `${g}-c${i}`, from: positions[a % n], to: positions[b % n], type: 'crossover', born: now + 450 + i * 180 })
  }

  return out
}

// ─── Shared geometry ──────────────────────────────────────────────────────────

const SPHERE_GEO = new THREE.SphereGeometry(1, 11, 11)
const DOT_GEO    = new THREE.SphereGeometry(1,  7,  7)

// ─── Camera orbit ─────────────────────────────────────────────────────────────

function CameraOrbit({
  mouse,
  radius,
}: {
  mouse: React.MutableRefObject<[number, number]>
  radius: number
}) {
  const { camera } = useThree()
  const angle = useRef(0)

  useFrame((_, dt) => {
    angle.current += dt * 0.10

    const tx = Math.sin(angle.current) * radius + mouse.current[0] * 1.5
    const ty = 2 + mouse.current[1] * 1.0
    const tz = Math.cos(angle.current) * radius

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

  const isDead = robot.state === 'DEAD'
  const base   = 0.1 + robot.fitness * 0.32
  const initS  = (robot.state === 'NEW' ? 0.15 : 1) * base

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
      t < 0.12 ? t / 0.12 : t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28
    ) * 0.7

    if (lineRef.current?.material) lineRef.current.material.opacity = op

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

function Scene({
  mouse,
  n,
  positions,
  orbitRadius,
  isMobile,
}: {
  mouse: React.MutableRefObject<[number, number]>
  n: number
  positions: [number, number, number][]
  orbitRadius: number
  isMobile: boolean
}) {
  const generations = useEvolutionStore(selectGenerations)
  const [conns, setConns] = useState<Conn[]>([])
  const prevLen = useRef(0)

  const robots = useMemo(
    () => buildRobots(generations, n, positions),
    [generations, n, positions],
  )

  useEffect(() => {
    if (generations.length <= prevLen.current) return
    const latest = generations[generations.length - 1]
    prevLen.current = generations.length
    const fresh = buildConns(latest, positions, n)
    const now   = performance.now()
    setConns(prev => [...prev.filter(c => now - c.born < CONN_LIFE_MS), ...fresh].slice(-18))
  }, [generations.length, n, positions])

  return (
    <>
      <color attach="background" args={['#07080A']} />
      <ambientLight intensity={0.06} />
      <pointLight position={[0,  6, 10]} intensity={1.2} color="#00F0FF" decay={2} />
      <pointLight position={[0, -4, -8]} intensity={0.3} color="#8060FF" decay={2} />

      <CameraOrbit mouse={mouse} radius={orbitRadius} />

      {robots.map((r, i) => <RobotNode key={i} robot={r} />)}
      {conns.map(c => <ConnLine key={c.key} conn={c} />)}

      {!isMobile && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.85} intensity={2.8} height={256} />
        </EffectComposer>
      )}
    </>
  )
}

// ─── HeroSection ─────────────────────────────────────────────────────────────

export function HeroSection() {
  const status     = useEvolutionStore(selectStatus)
  const generation = useEvolutionStore(selectCurrentGeneration)
  const bestEver   = useEvolutionStore(selectBestFitnessEver)

  // One-time mobile check as specified — no resize listener needed
  const isMobile    = typeof window !== 'undefined' && window.innerWidth < 768
  const robotCount  = isMobile ? 20 : 50
  const orbitRadius = isMobile ? 6  : 10

  // Scale positions for mobile: x(-5,5) y(-3,3) z(-3,2)
  const positions = useMemo<[number, number, number][]>(() =>
    isMobile
      ? POS50.map(([x, y, z]) => [x * 0.5, y * 0.5, z * 0.6] as [number, number, number])
      : POS50,
    [isMobile],
  )

  const mouse = useRef<[number, number]>([0, 0])

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mouse.current = [
          ((e.clientX - r.left) / r.width  - 0.5) * 2,
          -((e.clientY - r.top) / r.height - 0.5) * 2,
        ]
      }}
      onMouseLeave={() => { mouse.current = [0, 0] }}
    >
      {/* 3D canvas — absolutely fills the container */}
      <Canvas
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        camera={{ position: [0, 2, isMobile ? 6 : 10], fov: isMobile ? 65 : 60 }}
        dpr={[1, isMobile ? 1 : 1.5]}
        gl={{ antialias: false, alpha: false }}
      >
        <Scene
          mouse={mouse}
          n={robotCount}
          positions={positions}
          orbitRadius={orbitRadius}
          isMobile={isMobile}
        />
      </Canvas>

      {/* Status badge — top left */}
      <div className="absolute top-3 left-4" style={{ zIndex: 10, pointerEvents: 'none' }}>
        <p className="font-mono text-[10px] tracking-[0.25em] text-accent/60 uppercase">
          CES // Evolution System
        </p>
      </div>

      {/* Status badge — top right */}
      <div className="absolute top-3 right-4 flex items-center gap-1.5" style={{ zIndex: 10, pointerEvents: 'none' }}>
        <span className={`h-1.5 w-1.5 rounded-full ${
          status === 'EVOLVING'
            ? 'bg-accent animate-pulse shadow-[0_0_6px_rgba(0,240,255,0.7)]'
            : 'bg-text-secondary/40'
        }`} />
        <span className="font-mono text-[10px] tracking-widest text-text-secondary uppercase">
          {status}
        </span>
      </div>

      {/* ── COGNITO ERGO SUM — centered overlay ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          pointerEvents: 'none',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1
          className="font-heading font-bold tracking-[0.18em]"
          style={{
            fontSize: 'clamp(28px, 8vw, 64px)',
            color: 'rgba(244,246,248,0.92)',
            textShadow: '0 0 32px rgba(0,240,255,0.35), 0 2px 4px rgba(0,0,0,0.6)',
          }}
        >
          COGNITO ERGO SUM
        </h1>

        <div className="mt-3 flex items-center justify-center gap-6">
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

          <div className="h-8 w-px bg-accent/20" />

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
      <div className="absolute bottom-4 left-6 right-6" style={{ zIndex: 10, pointerEvents: 'none' }}>
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
  )
}
