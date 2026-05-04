import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-bg font-semibold shadow hover:bg-accent/90 hover:shadow-glow active:shadow-glow-lg',
        outline:
          'border border-accent/20 bg-transparent text-text-primary hover:border-accent/50 hover:shadow-glow',
        ghost: 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
        destructive: 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20',
        secondary: 'bg-bg-secondary border border-accent/08 text-text-secondary hover:text-text-primary',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded px-3 text-xs',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
