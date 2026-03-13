import { useState, useEffect } from 'react'
import { SaveIcon } from './Icons'
import { TAB_ROLES } from '../types'

interface ObsidianSyncProps {
  projectTitle: string
  markdown: string
  tabIndex: number
  tabColor: string
}

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

export default function ObsidianSync({ projectTitle, markdown, tabIndex, tabColor }: ObsidianSyncProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // Auto-save on content change with debounce
  useEffect(() => {
    if (!markdown.trim()) return

    const timer = setTimeout(() => {
      saveToObsidian()
    }, 2000)

    return () => clearTimeout(timer)
  }, [markdown, projectTitle, tabIndex])

  async function saveToObsidian() {
    try {
      setStatus('saving')
      const tabLabel = TAB_ROLES[tabIndex].label
      const filename = tabIndex === 0
        ? `${projectTitle}.md`
        : `${projectTitle} - ${tabLabel}.md`

      const frontmatter = `---
title: "${projectTitle}"
tab: ${tabLabel}
color: ${tabColor}
updated: ${new Date().toISOString()}
source: pensieve
---

`
      const fullContent = frontmatter + markdown

      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: fullContent }),
      })

      if (response.ok) {
        setStatus('saved')
        setLastSaved(new Date().toLocaleTimeString())
        setTimeout(() => setStatus('idle'), 2000)
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('offline')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const statusColors: Record<SyncStatus, string> = {
    idle: 'var(--text-muted)',
    saving: 'var(--tab-amber)',
    saved: 'var(--tab-sage)',
    error: 'var(--tab-coral)',
    offline: 'var(--text-muted)',
  }

  const statusText: Record<SyncStatus, string> = {
    idle: lastSaved ? `Saved ${lastSaved}` : 'Obsidian sync',
    saving: 'Saving...',
    saved: 'Saved to vault',
    error: 'Save failed',
    offline: 'Server offline',
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
      }}
      title="Auto-saves to Obsidian vault (Notes folder)"
    >
      <SaveIcon />
      <span>{statusText[status]}</span>
    </div>
  )
}
