import { useEffect, useRef, useCallback } from 'react'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function tauriInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

interface MirrorViewProps {
  draftMarkdown: string
  sourcesMarkdown: string
  projectTitle: string
  analysis: string
  onAnalysis: (a: string) => void
  status: 'idle' | 'analyzing' | 'done' | 'error'
  onStatus: (s: 'idle' | 'analyzing' | 'done' | 'error') => void
  lastUpdated: string | null
  onLastUpdated: (t: string | null) => void
}

const pulseKeyframes = `
@keyframes mirror-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
`

export default function MirrorView({
  draftMarkdown, sourcesMarkdown, projectTitle,
  analysis, onAnalysis, status, onStatus, lastUpdated, onLastUpdated,
}: MirrorViewProps) {
  const contentHashRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runAnalysis = useCallback(async () => {
    if (!draftMarkdown.trim() && !sourcesMarkdown.trim()) {
      onAnalysis('')
      onStatus('idle')
      return
    }

    onStatus('analyzing')

    try {
      let result: string

      if (isTauri()) {
        result = await tauriInvoke('analyze_mirror', {
          draftContent: draftMarkdown,
          sourcesContent: sourcesMarkdown,
          projectTitle,
        }) as string
      } else {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        try {
          const { supabase } = await import('../lib/supabase')
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        } catch { /* no auth available */ }

        const response = await fetch('/api/mirror', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            draftContent: draftMarkdown,
            sourcesContent: sourcesMarkdown,
            projectTitle,
          }),
        })
        if (!response.ok) throw new Error('API error')
        const data = await response.json()
        result = data.reply
      }

      onAnalysis(result)
      onStatus('done')
      onLastUpdated(new Date().toLocaleTimeString())
    } catch {
      onStatus('error')
    }
  }, [draftMarkdown, sourcesMarkdown, projectTitle, onAnalysis, onStatus, onLastUpdated])

  // Only re-analyze when content actually changes, not on remount
  useEffect(() => {
    const hash = `${draftMarkdown}|||${sourcesMarkdown}`
    if (hash === contentHashRef.current) return
    contentHashRef.current = hash

    // If we already have analysis and content hasn't changed, skip
    if (analysis && hash === contentHashRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      runAnalysis()
    }, 5000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [draftMarkdown, sourcesMarkdown, runAnalysis, analysis])

  // Run on first mount if no analysis exists yet
  useEffect(() => {
    if (!analysis && (draftMarkdown.trim() || sourcesMarkdown.trim()) && status === 'idle') {
      const hash = `${draftMarkdown}|||${sourcesMarkdown}`
      contentHashRef.current = hash
      runAnalysis()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Empty state
  if (!draftMarkdown.trim() && !sourcesMarkdown.trim()) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        color: 'var(--text-muted)',
        fontFamily: "'Inter', sans-serif",
        textAlign: 'center',
        gap: '16px',
      }}>
        <div style={{ fontSize: '36px', opacity: 0.3 }}>&#9671;</div>
        <div style={{ fontSize: '14px', maxWidth: '340px', lineHeight: 1.7 }}>
          Mirror reflects your writing back to you.
          <br />
          Start writing in <strong style={{ color: 'var(--text-secondary)' }}>Draft</strong> and it will come alive.
        </div>
      </div>
    )
  }

  // Loading state (first load only, no prior analysis)
  if (status === 'analyzing' && !analysis) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif",
        gap: '20px',
      }}>
        <style>{pulseKeyframes}</style>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--tab-sage)',
              animation: 'mirror-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
        <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Reading your draft and sources
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          This takes a few seconds
        </div>
      </div>
    )
  }

  // Render analysis — left-aligned, matching Draft typography
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '16px',
      lineHeight: 1.75,
      color: 'var(--text-primary)',
    }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '32px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontFamily: "'Inter', sans-serif",
      }}>
        {status === 'analyzing' && (
          <>
            <style>{pulseKeyframes}</style>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: 'var(--tab-sage)',
                  animation: 'mirror-pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <span>Updating</span>
          </>
        )}
        {status === 'done' && <span>Updated {lastUpdated}</span>}
        {status === 'error' && <span>Analysis failed</span>}
        <button
          onClick={runAnalysis}
          disabled={status === 'analyzing'}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '3px 10px',
            cursor: status === 'analyzing' ? 'default' : 'pointer',
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontFamily: "'Inter', sans-serif",
            opacity: status === 'analyzing' ? 0.4 : 1,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Analysis sections */}
      {analysis && (
        <div>
          {analysis.split('\n').map((line, i) => {
            // Section headers
            const headerMatch = line.match(/^([A-Z][A-Z\s]+?)(?::?\s*)$/) || line.match(/^([A-Z][A-Z\s]+):(.*)$/)
            if (headerMatch) {
              const isEssence = headerMatch[1].trim() === 'ESSENCE'
              if (isEssence) {
                // Render divider before ESSENCE, no header text
                return (
                  <div key={i} style={{
                    width: '40px',
                    height: '1px',
                    background: 'var(--border-color)',
                    margin: '36px 0 24px',
                  }} />
                )
              }
              return (
                <div key={i} style={{ marginTop: i > 0 ? '28px' : '0' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'var(--text-primary)',
                    fontFamily: "'Inter', sans-serif",
                  }}>
                    {headerMatch[1]}
                  </span>
                  {headerMatch[2]?.trim() && (
                    <div style={{
                      color: 'var(--text-secondary)',
                      marginTop: '8px',
                    }}>
                      {headerMatch[2].trim()}
                    </div>
                  )}
                </div>
              )
            }

            // Check if this line follows ESSENCE (after divider) — style it distinctly
            const prevLines = analysis.split('\n').slice(0, i)
            const lastHeader = [...prevLines].reverse().find(l => l.match(/^[A-Z][A-Z\s]+/))
            const isEssenceLine = lastHeader?.trim().startsWith('ESSENCE')

            // Bullet points
            if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
              return (
                <div key={i} style={{
                  paddingLeft: '16px',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                }}>
                  {line}
                </div>
              )
            }

            // Regular text
            if (line.trim()) {
              if (isEssenceLine) {
                return (
                  <div key={i} style={{
                    color: 'var(--text-primary)',
                    fontStyle: 'italic',
                    marginTop: '4px',
                    lineHeight: 1.75,
                  }}>
                    {line}
                  </div>
                )
              }
              return (
                <div key={i} style={{
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                }}>
                  {line}
                </div>
              )
            }
            return <div key={i} style={{ height: '8px' }} />
          })}
        </div>
      )}
    </div>
  )
}
