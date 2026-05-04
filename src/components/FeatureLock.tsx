import { Lock } from 'lucide-react'

interface FeatureLockProps {
  feature: string
  onUpgrade: () => void
}

export function FeatureLock({ feature, onUpgrade }: FeatureLockProps) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg backdrop-blur-sm"
      style={{ background: 'rgba(7,8,10,0.85)', fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <Lock className="h-6 w-6" style={{ color: '#00F0FF' }} />
      <div className="flex flex-col items-center gap-1 text-center px-6">
        <span className="text-[12px] text-[#F4F6F8]">{feature} is a Pro feature</span>
        <span className="text-[10px] text-[#A7B0B7]/60">Upgrade to Pro for £29/mo</span>
      </div>
      <button
        onClick={onUpgrade}
        className="text-[10px] uppercase tracking-widest px-4 py-2 rounded border transition-all duration-150 hover:shadow-glow"
        style={{
          color:       '#00F0FF',
          borderColor: '#00F0FF',
          background:  'transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,240,255,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        Upgrade to Pro
      </button>
    </div>
  )
}
