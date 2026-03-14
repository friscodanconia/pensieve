import { useState, useRef, useEffect } from 'react'
import { PensieveLogo } from './Icons'
import PaywallGate from './PaywallGate'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionStatus } from '../hooks/useSubscription'

interface AssistantPanelProps {
  visible: boolean
  onToggle: () => void
  editorContent: string
  user: User | null
  subscriptionStatus: SubscriptionStatus
  onSignIn: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AssistantPanel({ visible, onToggle, editorContent, user, subscriptionStatus, onSignIn }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Get auth token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user) {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: updatedMessages,
          editorContent,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `API error: ${response.status}`)
      }

      const data = await response.json()
      const reply: Message = { role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, reply])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Could not reach Pensieve.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg,
      }])
    } finally {
      setLoading(false)
    }
  }

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          transition: 'all 0.2s',
          zIndex: 50,
        }}
        title="Open assistant"
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}
      >
        <PensieveLogo size={20} />
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: '340px',
        maxHeight: '420px',
        background: 'var(--panel-bg)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        fontFamily: "'IBM Plex Mono', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PensieveLogo size={18} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Pensieve</span>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '18px',
            padding: '0 4px',
            lineHeight: 1,
          }}
          title="Minimize assistant"
        >
          —
        </button>
      </div>

      {/* Paywall gate — shows upgrade CTA for non-Pro users */}
      <PaywallGate user={user} subscriptionStatus={subscriptionStatus} onSignIn={onSignIn}>
        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: '200px',
          }}
        >
          {messages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
              Ask Pensieve to help you think through your writing.
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'var(--text-primary)' : 'var(--code-bg)',
                  color: msg.role === 'user' ? 'var(--bg-primary)' : 'var(--text-primary)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                {msg.content}
              </div>
            ))
          )}
          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: '12px 12px 12px 2px',
                background: 'var(--code-bg)',
                color: 'var(--text-muted)',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
              placeholder="Ask Pensieve..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '13px',
                outline: 'none',
                opacity: loading ? 0.6 : 1,
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? 'var(--text-muted)' : 'var(--text-primary)',
                color: 'var(--bg-primary)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '12px',
                cursor: loading ? 'default' : 'pointer',
                fontWeight: 500,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </PaywallGate>
    </div>
  )
}
