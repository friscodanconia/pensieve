import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionStatus } from '../hooks/useSubscription'

interface PaywallGateProps {
  user: User | null
  subscriptionStatus: SubscriptionStatus
  credits: number | null
  onSignIn: () => void
  children: React.ReactNode
}

export default function PaywallGate({ user, subscriptionStatus, credits, onSignIn, children }: PaywallGateProps) {
  const [upgrading, setUpgrading] = useState(false)

  // Subscriber: unlimited access
  if (user && subscriptionStatus === 'active') {
    return <>{children}</>
  }

  // Signed in with credits remaining: allow access
  if (user && credits !== null && credits > 0) {
    return <>{children}</>
  }

  // Not signed in
  if (!user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px',
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif",
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
          Sign in to Pensieve
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '260px', lineHeight: 1.5 }}>
          Sign in to use the AI writing assistant, Mirror analysis, and source extraction. You get 20 free credits to start.
        </p>
        <button
          onClick={onSignIn}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </div>
    )
  }

  // Signed in, no credits, no subscription
  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // Checkout failed silently
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '32px',
      textAlign: 'center',
      fontFamily: "'Inter', sans-serif",
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
        Credits used up
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', maxWidth: '280px', lineHeight: 1.5 }}>
        Subscribe to Pensieve Pro for unlimited access to the AI assistant, Mirror analysis, and source extraction.
      </p>
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
        $8/month or $48/year
      </p>
      <button
        onClick={handleUpgrade}
        disabled={upgrading}
        style={{
          padding: '10px 24px',
          borderRadius: '8px',
          border: 'none',
          background: upgrading ? 'var(--text-muted)' : 'var(--text-primary)',
          color: 'var(--bg-primary)',
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          cursor: upgrading ? 'default' : 'pointer',
        }}
      >
        {upgrading ? 'Redirecting...' : 'Subscribe'}
      </button>
    </div>
  )
}
