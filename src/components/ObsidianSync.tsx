import { useState, useEffect, useRef, useCallback } from 'react'
import { SaveIcon } from './Icons'
import { TAB_ROLES } from '../types'

interface ObsidianSyncProps {
  projectTitle: string
  markdown: string
  tabIndex: number
  tabColor: string
}

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'retrying'

export default function ObsidianSync({ projectTitle, markdown, tabIndex, tabColor }: ObsidianSyncProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Track the latest values for beforeunload flush
  const latestRef = useRef({ projectTitle, markdown, tabIndex, tabColor })
  const pendingRef = useRef(false)
  const lastSavedContentRef = useRef('')

  useEffect(() => {
    latestRef.current = { projectTitle, markdown, tabIndex, tabColor }
  }, [projectTitle, markdown, tabIndex, tabColor])

  const buildPayload = useCallback((title: string, md: string, idx: number, color: string) => {
    const tabLabel = TAB_ROLES[idx].label
    const filename = idx === 0
      ? `${title}.md`
      : `${title} - ${tabLabel}.md`
    const frontmatter = `---
title: "${title}"
tab: ${tabLabel}
color: ${color}
updated: ${new Date().toISOString()}
source: pensieve
---

`
    return { filename, content: frontmatter + md }
  }, [])

  const saveToCloud = useCallback(async (retry = 0): Promise<boolean> => {
    const { projectTitle: title, markdown: md, tabIndex: idx, tabColor: color } = latestRef.current
    if (!md.trim()) return true

    const payload = buildPayload(title, md, idx, color)

    try {
      if (retry > 0) setStatus('retrying')
      else setStatus('saving')

      pendingRef.current = true

      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        pendingRef.current = false
        lastSavedContentRef.current = md
        setRetryCount(0)
        setStatus('saved')
        setLastSaved(new Date().toLocaleTimeString())
        setTimeout(() => setStatus('idle'), 2000)
        return true
      } else {
        // Retry up to 2 times with backoff
        if (retry < 2) {
          await new Promise(r => setTimeout(r, (retry + 1) * 2000))
          return saveToCloud(retry + 1)
        }
        pendingRef.current = false
        setRetryCount(retry)
        setStatus('error')
        return false
      }
    } catch {
      if (retry < 2) {
        await new Promise(r => setTimeout(r, (retry + 1) * 2000))
        return saveToCloud(retry + 1)
      }
      pendingRef.current = false
      setRetryCount(retry)
      setStatus('offline')
      return false
    }
  }, [buildPayload])

  // Auto-save on content change with debounce
  useEffect(() => {
    if (!markdown.trim()) return
    // Skip if content hasn't actually changed since last save
    if (markdown === lastSavedContentRef.current) return

    pendingRef.current = true
    const timer = setTimeout(() => {
      saveToCloud()
    }, 2000)

    return () => clearTimeout(timer)
  }, [markdown, projectTitle, tabIndex, saveToCloud])

  // Flush unsaved content on tab switch (immediate save, no debounce)
  const prevTabRef = useRef(tabIndex)
  useEffect(() => {
    if (prevTabRef.current !== tabIndex) {
      // Save the previous tab's content immediately
      if (pendingRef.current && lastSavedContentRef.current !== latestRef.current.markdown) {
        saveToCloud()
      }
      prevTabRef.current = tabIndex
    }
  }, [tabIndex, saveToCloud])

  // Flush on page close / navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!pendingRef.current) return
      const { projectTitle: title, markdown: md, tabIndex: idx, tabColor: color } = latestRef.current
      if (!md.trim() || md === lastSavedContentRef.current) return

      const payload = buildPayload(title, md, idx, color)

      // Use sendBeacon for reliable save during page unload
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      navigator.sendBeacon('/api/save', blob)
    }

    // Also save on visibility change (phone switching apps, etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current) {
        const { markdown: md } = latestRef.current
        if (md.trim() && md !== lastSavedContentRef.current) {
          saveToCloud()
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [buildPayload, saveToCloud])

  const statusColors: Record<SyncStatus, string> = {
    idle: 'var(--text-muted)',
    saving: 'var(--tab-amber)',
    saved: 'var(--tab-sage)',
    error: 'var(--tab-coral)',
    offline: 'var(--tab-coral)',
    retrying: 'var(--tab-amber)',
  }

  const statusText: Record<SyncStatus, string> = {
    idle: lastSaved ? `Synced ${lastSaved}` : 'Cloud sync',
    saving: 'Syncing...',
    saved: 'Synced',
    error: `Sync failed${retryCount > 0 ? ` (${retryCount} retries)` : ''} — will retry`,
    offline: 'Offline — saved locally',
    retrying: 'Retrying...',
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: statusColors[status],
        fontFamily: "'IBM Plex Mono', monospace",
        transition: 'color 0.3s',
        cursor: status === 'error' || status === 'offline' ? 'pointer' : 'default',
      }}
      title={
        status === 'error' || status === 'offline'
          ? 'Click to retry sync'
          : 'Auto-syncs to GitHub → Obsidian vault'
      }
      onClick={() => {
        if (status === 'error' || status === 'offline') {
          saveToCloud()
        }
      }}
    >
      <SaveIcon />
      <span>{statusText[status]}</span>
    </div>
  )
}
