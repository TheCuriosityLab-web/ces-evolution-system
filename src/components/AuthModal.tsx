import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signInWithEmail, signUpWithEmail } from '@/lib/supabase'

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [view,     setView]     = useState<'signin' | 'signup'>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  const reset = () => {
    setEmail('')
    setPassword('')
    setError(null)
    setSuccess(null)
    setLoading(false)
  }

  const switchView = (v: 'signin' | 'signup') => {
    reset()
    setView(v)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const { error } = view === 'signin'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (view === 'signup') {
      setSuccess('Account created — check your email to confirm.')
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent
        className="max-w-sm"
        style={{ background: '#0E1116', border: '1px solid rgba(0,240,255,0.15)', ...MONO }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-[10px] tracking-widest uppercase"
            style={{ color: '#A7B0B7', ...MONO }}
          >
            {view === 'signin' ? 'Sign In' : 'Create Account'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#A7B0B7] tracking-widest uppercase">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={MONO}
              className="text-[12px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#A7B0B7] tracking-widest uppercase">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
              style={MONO}
              className="text-[12px]"
            />
          </div>

          {error && (
            <p className="text-[11px]" style={{ color: '#FF4560', ...MONO }}>{error}</p>
          )}

          {success && (
            <p className="text-[11px]" style={{ color: '#00FF88', ...MONO }}>{success}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full text-[11px] tracking-widest uppercase"
            style={MONO}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : view === 'signin' ? 'Sign In' : 'Create Account'
            }
          </Button>
        </form>

        <p className="text-center text-[10px] text-[#A7B0B7]/60 mt-1" style={MONO}>
          {view === 'signin' ? (
            <>No account?{' '}
              <button
                type="button"
                className="text-[#00F0FF] hover:underline"
                onClick={() => switchView('signup')}
              >
                Sign up
              </button>
            </>
          ) : (
            <>Already have one?{' '}
              <button
                type="button"
                className="text-[#00F0FF] hover:underline"
                onClick={() => switchView('signin')}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  )
}
