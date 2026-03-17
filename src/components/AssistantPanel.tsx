import { useState, useRef, useEffect } from 'react'
import { PensieveLogo } from './Icons'
import PaywallGate from './PaywallGate'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionStatus } from '../hooks/useSubscription'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function tauriInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

interface AssistantPanelProps {
  visible: boolean
  onToggle: () => void
  editorContent: string
  user: User | null
  subscriptionStatus: SubscriptionStatus
  credits: number | null
  onSignIn: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AssistantPanel({ visible, onToggle, editorContent, user, subscriptionStatus, credits, onSignIn }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const tauri = isTauri()

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
      let reply: string

      if (tauri) {
        reply = await tauriInvoke('chat_with_assistant', {
          messages: updatedMessages,
          editorContent,
        }) as string
      } else {
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
          body: JSON.stringify({ messages: updatedMessages, editorContent }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `API error: ${response.status}`)
        }

        const data = await response.json()
        reply = data.reply
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Could not reach Pensieve.'
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }])
    } finally {
      setLoading(false)
    }
  }

  // Collapsed: small pill button, bottom-right
  if (!visible) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          height: '40px',
          borderRadius: '20px',
          background: '#2a2520',
          border: 'none',
          boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 16px 0 12px',
          color: '#e8ddd0',
          fontFamily: "'Inter', sans-serif",
          fontSize: '12px',
          fontWeight: 500,
          transition: 'all 0.2s',
          zIndex: 50,
        }}
        title="Open writing assistant"
        onMouseEnter={e => {
          e.currentTarget.style.background = '#3a3530'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#2a2520'
          e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.15)'
        }}
      >
        <PensieveLogo size={16} />
        <span>Assistant</span>
      </button>
    )
  }

  const chatUI = (
    <>
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            color: '#8a7e72',
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '60px',
            lineHeight: 1.6,
          }}>
            Ask Pensieve to help you<br />think through your writing.
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
                background: msg.role === 'user' ? '#e8705a' : '#3a3530',
                color: msg.role === 'user' ? '#fff' : '#e8ddd0',
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
              background: '#3a3530',
              color: '#8a7e72',
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
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #3a3530',
      }}>
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
              border: '1px solid #3a3530',
              borderRadius: '8px',
              background: '#1e1b18',
              color: '#e8ddd0',
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
              background: loading ? '#4a4540' : '#e8705a',
              color: '#fff',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              cursor: loading ? 'default' : 'pointer',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </>
  )

  // Expanded: right sidebar, full height
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '380px',
        background: '#2a2520',
        borderLeft: '1px solid #3a3530',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px',
          borderBottom: '1px solid #3a3530',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e8ddd0' }}>
          <PensieveLogo size={18} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Pensieve</span>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#8a7e72',
            fontSize: '20px',
            padding: '2px 6px',
            lineHeight: 1,
            borderRadius: '4px',
          }}
          title="Close assistant"
          onMouseEnter={e => e.currentTarget.style.color = '#e8ddd0'}
          onMouseLeave={e => e.currentTarget.style.color = '#8a7e72'}
        >
          ×
        </button>
      </div>

      {tauri ? chatUI : (
        <PaywallGate user={user} subscriptionStatus={subscriptionStatus} credits={credits} onSignIn={onSignIn}>
          {chatUI}
        </PaywallGate>
      )}
    </div>
  )
}
