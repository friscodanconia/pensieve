import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'loading'

export function useSubscription(user: User | null): SubscriptionStatus {
  const [status, setStatus] = useState<SubscriptionStatus>('loading')

  useEffect(() => {
    if (!user) {
      setStatus('free')
      return
    }

    let cancelled = false

    async function check() {
      try {
        const response = await fetch('/api/subscription-status', {
          headers: {
            Authorization: `Bearer ${(await (await import('../lib/supabase')).supabase.auth.getSession()).data.session?.access_token}`,
          },
        })
        if (!cancelled && response.ok) {
          const data = await response.json()
          setStatus(data.status || 'free')
        } else if (!cancelled) {
          setStatus('free')
        }
      } catch {
        if (!cancelled) setStatus('free')
      }
    }

    check()
    return () => { cancelled = true }
  }, [user])

  return status
}
