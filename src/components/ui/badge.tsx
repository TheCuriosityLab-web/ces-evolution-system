import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent/10 text-accent shadow hover:bg-accent/20',
        secondary: 'border-transparent bg-bg-secondary text-text-secondary hover:bg-bg-secondary/80',
        destructive: 'border-transparent bg-red-500/10 text-red-400',
        outline: 'border-accent/20 text-text-secondary',
        evolving: 'border-accent/30 bg-accent/10 text-accent animate-pulse-glow',
        paused: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
        converged: 'border-green-500/30 bg-green-500/10 text-green-400',
        disconnected: 'border-red-500/30 bg-red-500/10 text-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
