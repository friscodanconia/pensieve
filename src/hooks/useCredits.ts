import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'

export function useCredits(user: User | null) {
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch credits on sign-in
  useEffect(() => {
    if (!user) {
      setCredits(null)
      return
    }

    async function fetchCredits() {
      setLoading(true)
      try {
        const { supabase } = await import('../lib/supabase')
        const { data } = await supabase
          .from('profiles')
          .select('credits, subscription_status')
          .eq('id', user!.id)
          .single()

        if (data?.subscription_status === 'active') {
          setCredits(-1) // -1 means unlimited (subscriber)
        } else {
          setCredits(data?.credits ?? 0)
        }
      } catch {
        setCredits(0)
      } finally {
        setLoading(false)
      }
    }

    fetchCredits()
  }, [user])

  // Update credits from API response header
  const updateFromResponse = useCallback((response: Response) => {
    const remaining = response.headers.get('X-Credits-Remaining')
    if (remaining !== null) {
      setCredits(parseInt(remaining, 10))
    }
  }, [])

  const isUnlimited = credits === -1
  const hasCredits = isUnlimited || (credits !== null && credits > 0)
  const displayCredits = isUnlimited ? 'Unlimited' : credits !== null ? `${credits} credits` : ''

  return { credits, hasCredits, isUnlimited, displayCredits, loading, updateFromResponse, setCredits }
}
