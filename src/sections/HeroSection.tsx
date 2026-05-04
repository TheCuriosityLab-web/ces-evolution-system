import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  useEvolutionStore,
  selectStatus,
  selectCurrentGeneration,
  selectBestFitnessEver,
  selectSelectedAgent,
} from '@/store/evolutionStore'

const PARTICLE_COUNT = 800

// ─── Particle Field ──────────────────────────────────────────────────────────
function ParticleField({ fitness, isEvolving }: { fitness: number; isEvolving: boolean }) {
  const pointsRef = useRef<THREE.Points>(null)

  // Stable Float32Arrays — never recreated
  const posArr = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Distribute on a flattened sphere shell
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 2.5 + Math.random() * 3.5
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55
      arr[i * 3 + 2] = r * Math.cos(phi) * 0.35
    }
    return arr
  }, [])

  const phaseArr = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 2)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 2]     = Math.random() * Math.PI * 2
      arr[i * 2 + 1] = Math.random() * Math.PI * 2
    }
    return arr
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    return geo
  }, [posArr])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const t       = clock.getElapsedTime()
    const pos     = geometry.attributes.position.array as Float32Array
    // Attraction ramps up with fitness — best fitness clusters everything to centre
    const attract = isEvolving ? fitness * 0.018 : 0.002

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const px  = phaseArr[i * 2]
      const py  = phaseArr[i * 2 + 1]
      const idx = i * 3

      // Individual drift: slow sinusoidal wander
      pos[idx]     += Math.sin(t * 0.22 + px) * 0.0025
      pos[idx + 1] += Math.cos(t * 0.28 + py) * 0.0025
      pos[idx + 2] += Math.sin(t * 0.18 + px + py) * 0.0015

      // Centripetal attraction — pulls toward origin as fitness improves
      pos[idx]     -= pos[idx]     * attract
      pos[idx + 1] -= pos[idx + 1] * attract
      pos[idx + 2] -= pos[idx + 2] * attract
    }

    geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.055}
        color="#00F0FF"
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function Scene({ fitness, isEvolving }: { fitness: number; isEvolving: boolean }) {
  return (
    <>
      <color attach="background" args={['#07080A']} />
      <ambientLight intensity={0.1} />
      <ParticleField fitness={fitness} isEvolving={isEvolving} />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.05}
          luminanceSmoothing={0.85}
          intensity={1.8}
          height={256}
        />
      </EffectComposer>
    </>
  )
}

// ─── HeroSection ─────────────────────────────────────────────────────────────
export function HeroSection() {
  const status     = useEvolutionStore(selectStatus)
  const generation = useEvolutionStore(selectCurrentGeneration)
  const bestEver   = useEvolutionStore(selectBestFitnessEver)
  const agent      = useEvolutionStore(selectSelectedAgent)
  const isEvolving = status === 'EVOLVING'

  const fitness    = agent?.fitness ?? 0
  const fitnessDisplay = (bestEver * 100).toFixed(4)

  return (
    <div className="relative w-full h-64 overflow-hidden rounded-xl border border-accent/[0.08]">
      {/* Three.js canvas */}
      <Canvas
        className="absolute inset-0"
        camera={{ position: [0, 0, 7], fov: 58 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false }}
      >
        <Scene fitness={fitness} isEvolving={isEvolving} />
      </Canvas>

      {/* Overlay — pointer-events-none so canvas stays interactive */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {/* Top label */}
        <p className="absolute top-3 left-4 font-mono text-[10px] tracking-[0.25em] text-accent/60 uppercase">
          CES // Evolution System
        </p>

        {/* Status badge top-right */}
        <div className="absolute top-3 right-4 flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isEvolving ? 'bg-accent animate-pulse' : 'bg-text-secondary/40'
            }`}
          />
          <span className="font-mono text-[10px] tracking-widest text-text-secondary uppercase">
            {status}
          </span>
        </div>

        {/* Main heading */}
        <h1 className="font-heading text-3xl font-bold tracking-[0.18em] text-text-primary drop-shadow-lg">
          COGNITO ERGO SUM
        </h1>

        {/* Generation counter */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
              Generation
            </span>
            <span className="font-mono text-2xl font-semibold text-accent tabular-nums">
              {String(generation).padStart(5, '0')}
            </span>
          </div>

          <div className="h-8 w-px bg-accent/20" />

          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
              Peak Fitness
            </span>
            <span className="font-mono text-2xl font-semibold text-text-primary tabular-nums">
              {fitnessDisplay}
              <span className="text-sm text-text-secondary">%</span>
            </span>
          </div>
        </div>

        {/* Fitness progress bar */}
        <div className="absolute bottom-4 left-6 right-6">
          <div className="h-px bg-accent/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-700 ease-out rounded-full"
              style={{ width: `${bestEver * 100}%`, boxShadow: '0 0 8px rgba(0,240,255,0.6)' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[9px] text-text-secondary/50">0%</span>
            <span className="font-mono text-[9px] text-accent/60">FITNESS LANDSCAPE</span>
            <span className="font-mono text-[9px] text-text-secondary/50">100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
