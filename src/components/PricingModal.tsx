import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PLANS, stripePromise, type PlanKey } from '@/lib/stripe'

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

// TODO: replace with your real Stripe Payment Link URLs
const PAYMENT_LINKS: Partial<Record<PlanKey, string>> = {
  PRO:  'https://buy.stripe.com/test_YOUR_PRO_LINK',
  TEAM: 'https://buy.stripe.com/test_YOUR_TEAM_LINK',
}

interface PricingModalProps {
  open: boolean
  onClose: () => void
}

export function PricingModal({ open, onClose }: PricingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async (key: PlanKey) => {
    if (key === 'FREE') return
    setLoadingPlan(key)
    setError(null)
    try {
      const stripe = await stripePromise
      if (!stripe) {
        setError('Failed to load payment processor — please refresh and try again.')
        return
      }
      const link = PAYMENT_LINKS[key]
      if (link) window.open(link, '_blank')
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl" style={{ background: '#0E1116', ...MONO }}>
        <DialogHeader>
          <DialogTitle
            className="text-[10px] tracking-widest uppercase"
            style={{ color: '#A7B0B7', ...MONO }}
          >
            Choose a Plan
          </DialogTitle>
          <p className="text-[11px] text-[#A7B0B7]/60" style={MONO}>
            Upgrade to unlock advanced evolution features.
          </p>
        </DialogHeader>

        {error && (
          <p
            className="text-[11px] px-3 py-2 rounded"
            style={{
              background:  'rgba(255,60,60,0.10)',
              color:       '#FF6B6B',
              border:      '1px solid rgba(255,60,60,0.25)',
              ...MONO,
            }}
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-4">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
            const isPro     = key === 'PRO'
            const isFree    = key === 'FREE'

            return (
              <div
                key={key}
                className="relative flex flex-col rounded-lg p-5 gap-4"
                style={{
                  background:   isPro ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)',
                  border:       isPro ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow:    isPro ? '0 0 24px rgba(0,240,255,0.08)' : 'none',
                }}
              >
                {/* Most popular badge */}
                {isPro && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest px-3 py-0.5 rounded-full border"
                    style={{
                      color:       '#00F0FF',
                      borderColor: '#00F0FF',
                      background:  '#0E1116',
                      ...MONO,
                    }}
                  >
                    MOST POPULAR
                  </span>
                )}

                {/* Plan name */}
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[11px] tracking-widest uppercase"
                    style={{ color: isPro ? '#00F0FF' : '#A7B0B7' }}
                  >
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: isFree ? '#A7B0B7' : '#F4F6F8' }}
                    >
                      {isFree ? 'Free' : `£${plan.price}`}
                    </span>
                    {!isFree && (
                      <span className="text-[10px] text-[#A7B0B7]/60">/mo</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[11px] text-[#A7B0B7]">
                      <Check
                        className="h-3 w-3 mt-0.5 shrink-0"
                        style={{ color: isPro ? '#00F0FF' : '#00FF88' }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <button
                  disabled={isFree || loadingPlan !== null}
                  onClick={() => handleUpgrade(key)}
                  className="w-full py-2 rounded text-[11px] font-bold tracking-widest uppercase transition-all duration-150 disabled:opacity-40 disabled:cursor-default flex items-center justify-center gap-1.5"
                  style={{
                    background:  isPro ? '#00F0FF' : 'transparent',
                    color:       isPro ? '#07080A' : '#A7B0B7',
                    border:      isPro ? 'none' : '1px solid rgba(255,255,255,0.12)',
                    ...MONO,
                  }}
                  onMouseEnter={(e) => {
                    if (!isFree && !isPro && loadingPlan === null) {
                      e.currentTarget.style.borderColor = '#00F0FF'
                      e.currentTarget.style.color = '#00F0FF'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isFree && !isPro) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                      e.currentTarget.style.color = '#A7B0B7'
                    }
                  }}
                >
                  {loadingPlan === key && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {isFree ? 'Current plan' : `Upgrade to ${plan.name}`}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
