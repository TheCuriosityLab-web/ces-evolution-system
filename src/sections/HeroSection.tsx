import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  useEvolutionStore,
  selectStatus,
  selectCurrentGeneration,
  selectBestFitnessEver,
} from '@/store/evolutionStore'

function useParticleCount() {
  const [count, setCount] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 800 : 2000
  )
  useEffect(() => {
    const update = () => setCount(window.innerWidth < 768 ? 800 : 2000)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return count
}

// ─── Camera Parallax ──────────────────────────────────────────────────────────
function CameraParallax({ mouse }: { mouse: React.MutableRefObject<[number, number]> }) {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.x += (mouse.current[0] * 0.8 - camera.position.x) * 0.04
    camera.position.y += (mouse.current[1] * 0.5 - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
  })
  return null
}

// ─── Particle Field ──────────────────────────────────────────────────────────
function ParticleField({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null)

  const { posArr, baseArr } = useMemo(() => {
    const posArr  = new Float32Array(count * 3)
    const baseArr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 2 - 1) * 15   // -15 to 15
      const y = (Math.random() * 2 - 1) * 8    // -8 to 8
      const z = Math.random() * 15 - 10         // -10 to 5
      posArr[i * 3]      = x
      posArr[i * 3 + 1]  = y
      posArr[i * 3 + 2]  = z
      baseArr[i * 3]     = x
      baseArr[i * 3 + 1] = y
      baseArr[i * 3 + 2] = z
    }
    return { posArr, baseArr }
  }, [count])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    return geo
  }, [posArr])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const time = clock.getElapsedTime() * 1000  // ms
    const pos  = geometry.attributes.position.array as Float32Array

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      pos[idx]     += Math.sin(time * 0.001 * (i + 1)) * 0.001
      pos[idx + 1] += Math.cos(time * 0.0008 * (i + 1)) * 0.001
    }

    geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.045}
        color="#00F0FF"
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function Scene({
  count,
  mouse,
}: {
  count: number
  mouse: React.MutableRefObject<[number, number]>
}) {
  return (
    <>
      <color attach="background" args={['#07080A']} />
      <ambientLight intensity={0.1} />
      <CameraParallax mouse={mouse} />
      <ParticleField count={count} />
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
  const isEvolving     = status === 'EVOLVING'
  const fitnessDisplay = (bestEver * 100).toFixed(4)
  const count          = useParticleCount()
  const mouse          = useRef<[number, number]>([0, 0])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouse.current = [
      ((e.clientX - rect.left) / rect.width  - 0.5) * 2,
      -((e.clientY - rect.top)  / rect.height - 0.5) * 2,
    ]
  }

  const handleMouseLeave = () => {
    mouse.current = [0, 0]
  }

  return (
    <div
      className="relative w-full h-[280px] overflow-hidden rounded-xl border border-accent/[0.08]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Three.js canvas — fills hero section */}
      <Canvas
        style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
        camera={{ position: [0, 0, 8], fov: 58 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false }}
      >
        <Scene count={count} mouse={mouse} />
      </Canvas>

      {/* Overlay — z-index 10, pointer-events-none */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
        style={{ zIndex: 10 }}
      >
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
        <h1
          className="font-heading font-bold tracking-[0.18em] text-text-primary drop-shadow-lg"
          style={{ fontSize: 'clamp(28px, 8vw, 64px)' }}
        >
          COGNITO ERGO SUM
        </h1>

        {/* Generation counter — 2-col grid on mobile, row on desktop */}
        <div className="mt-3 grid grid-cols-2 md:flex md:items-center gap-3 md:gap-4">
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
              Generation
            </span>
            <span className="font-mono text-xl md:text-2xl font-semibold text-accent tabular-nums">
              {String(generation).padStart(5, '0')}
            </span>
          </div>

          <div className="hidden md:block h-8 w-px bg-accent/20" />

          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
              Peak Fitness
            </span>
            <span className="font-mono text-xl md:text-2xl font-semibold text-text-primary tabular-nums">
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
