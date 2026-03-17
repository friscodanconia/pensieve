import { useState, useEffect, useRef, useCallback } from 'react'
import { SaveIcon } from './Icons'
import { TAB_ROLES } from '../types'

interface ObsidianSyncProps {
  projectTitle: string
  markdown: string
  tabIndex: number
  tabColor: string
  userEmail: string | null
}

const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL || ''

// Check at call time, not module load time — Tauri may inject globals after module eval
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'retrying'

async function tauriInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

export default function ObsidianSync({ projectTitle, markdown, tabIndex, tabColor, userEmail }: ObsidianSyncProps) {
  const tauri = isTauri()

  // In Tauri, it's always the owner's machine — skip email gate
  // On web, only show for the owner
  if (!tauri && OWNER_EMAIL && userEmail !== OWNER_EMAIL) return null

  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [vaultExists, setVaultExists] = useState(true)

  // Check if vault exists on first render (Tauri only)
  useEffect(() => {
    if (tauri) {
      tauriInvoke('get_vault_path', {}).then((path) => {
        // If we got a path, check if saving works by looking at the result
        // The vault check happens server-side in save_to_vault
        if (path) setVaultExists(true)
      }).catch(() => setVaultExists(false))
    }
  }, [tauri])

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

      if (isTauri()) {
        // Native app: write directly to Obsidian vault via Rust backend
        const result = await tauriInvoke('save_to_vault', {
          filename: payload.filename,
          content: payload.content,
        }) as string
        // If no vault found, hide sync UI silently
        if (result.includes('skipped')) {
          setVaultExists(false)
          pendingRef.current = false
          setStatus('idle')
          return true
        }
      } else {
        // Web: use Vercel API route
        const response = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      }

      pendingRef.current = false
      lastSavedContentRef.current = md
      setRetryCount(0)
      setStatus('saved')
      setLastSaved(new Date().toLocaleTimeString())
      setTimeout(() => setStatus('idle'), 2000)
      return true
    } catch {
      if (retry < 2) {
        await new Promise(r => setTimeout(r, (retry + 1) * 2000))
        return saveToCloud(retry + 1)
      }
      pendingRef.current = false
      setRetryCount(retry)
      setStatus(isTauri() ? 'error' : 'offline')
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

      if (isTauri()) {
        tauriInvoke('save_to_vault', { filename: payload.filename, content: payload.content }).catch(() => {})
      } else {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
        navigator.sendBeacon('/api/save', blob)
      }
    }

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

  // Hide sync UI entirely if no vault found
  if (tauri && !vaultExists) return null

  const statusColors: Record<SyncStatus, string> = {
    idle: 'var(--text-muted)',
    saving: 'var(--tab-amber)',
    saved: 'var(--tab-sage)',
    error: 'var(--tab-coral)',
    offline: 'var(--tab-coral)',
    retrying: 'var(--tab-amber)',
  }

  const statusText: Record<SyncStatus, string> = {
    idle: lastSaved ? `Synced ${lastSaved}` : (tauri ? 'Vault sync' : 'Cloud sync'),
    saving: tauri ? 'Saving to vault...' : 'Syncing...',
    saved: tauri ? 'Saved to vault' : 'Synced',
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
          : tauri ? 'Auto-saves to Obsidian vault' : 'Auto-syncs to GitHub → Obsidian vault'
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
