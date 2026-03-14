import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionStatus } from '../hooks/useSubscription'

interface PaywallGateProps {
  user: User | null
  subscriptionStatus: SubscriptionStatus
  onSignIn: () => void
  children: React.ReactNode
}

export default function PaywallGate({ user, subscriptionStatus, onSignIn, children }: PaywallGateProps) {
  const [upgrading, setUpgrading] = useState(false)

  // Pro users — show the assistant
  if (user && subscriptionStatus === 'active') {
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
        <div style={{ fontSize: '28px', marginBottom: '12px' }}>&#9998;</div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
          Pensieve Pro
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '260px', lineHeight: 1.5 }}>
          Sign in to unlock the AI writing assistant that helps you think deeper.
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

  // Signed in but free tier
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
      <div style={{ fontSize: '28px', marginBottom: '12px' }}>&#9998;</div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
        Upgrade to Pensieve Pro
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', maxWidth: '260px', lineHeight: 1.5 }}>
        An AI assistant that reads your draft and helps you think — asks probing questions, flags weak spots, suggests structure.
      </p>
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
        $8/month
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
