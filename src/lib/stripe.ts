import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export interface Plan {
  name: string
  price: number
  features: string[]
}

export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    features: [
      'Basic evolution',
      '50 generations max',
      'Sine wave only',
    ],
  },
  PRO: {
    name: 'Pro',
    price: 29,
    features: [
      'Unlimited generations',
      'CSV upload',
      'Intelligence panel',
      'Export results',
    ],
  },
  TEAM: {
    name: 'Team',
    price: 99,
    features: [
      'Everything in Pro',
      'Save runs',
      'Share results',
      'API access',
    ],
  },
} satisfies Record<string, Plan>

export type PlanKey = keyof typeof PLANS
