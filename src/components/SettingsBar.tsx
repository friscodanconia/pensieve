import { useState, useRef, useEffect } from 'react'
import { FocusIcon, HelpIcon, UserIcon, EyeIcon, EyeOffIcon } from './Icons'
import type { User } from '@supabase/supabase-js'

interface SettingsBarProps {
  projectTitle: string
  wordCount: number
  focusMode: boolean
  onFocusToggle: () => void
  visible: boolean
  onToggleVisible: () => void
  user: User | null
  onSignIn: () => void
  onSignOut: () => void
}

const SHORTCUTS = [
  { keys: 'Cmd+K', action: 'Insert link' },
  { keys: 'Cmd+B', action: 'Bold' },
  { keys: 'Cmd+I', action: 'Italic' },
  { keys: 'Cmd+Z', action: 'Undo' },
  { keys: 'Cmd+Shift+Z', action: 'Redo' },
]

const MARKDOWN = [
  { syntax: '#', action: 'Heading' },
  { syntax: '**text**', action: 'Bold' },
  { syntax: '*text*', action: 'Italic' },
  { syntax: '~~text~~', action: 'Strikethrough' },
  { syntax: '`code`', action: 'Inline code' },
  { syntax: '>', action: 'Blockquote' },
  { syntax: '-', action: 'Bullet list' },
  { syntax: '1.', action: 'Numbered list' },
  { syntax: '---', action: 'Divider' },
  { syntax: '[text](url)', action: 'Link' },
]

export default function SettingsBar({
  projectTitle,
  wordCount,
  focusMode,
  onFocusToggle,
  visible,
  onToggleVisible,
  user,
  onSignIn,
  onSignOut,
}: SettingsBarProps) {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const shortcutsRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShowShortcuts(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    if (showShortcuts || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showShortcuts, showUserMenu])

  if (!visible) {
    return (
      <button
        onClick={onToggleVisible}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '4px',
          zIndex: 50,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Show settings"
      >
        <EyeIcon />
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'var(--bg-primary)',
        zIndex: 40,
        borderBottom: '1px solid transparent',
        fontFamily: "'Inter', sans-serif",
        fontSize: '13px',
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
        {projectTitle}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: 'var(--text-muted)', marginRight: '8px', fontSize: '13px' }}>
          {wordCount} words
        </span>

        <button
          onClick={onFocusToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: focusMode ? 'var(--tab-coral)' : 'var(--text-muted)',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
          }}
          title={`Focus: ${focusMode ? 'On' : 'Off'}`}
        >
          <FocusIcon />
        </button>

        <div ref={shortcutsRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            style={{
              background: showShortcuts ? 'var(--code-bg)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            title="Shortcuts & formatting"
          >
            <HelpIcon />
          </button>

          {showShortcuts && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'var(--panel-bg)',
                borderRadius: '10px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
                padding: '16px 20px',
                width: '320px',
                zIndex: 100,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '12px',
              }}
            >
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Shortcuts
              </div>
              {SHORTCUTS.map(s => (
                <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--text-secondary)' }}>
                  <code style={{ background: 'var(--code-bg)', padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>{s.keys}</code>
                  <span>{s.action}</span>
                </div>
              ))}

              <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '14px 0 10px' }}>
                Markdown
              </div>
              {MARKDOWN.map(m => (
                <div key={m.syntax} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--text-secondary)' }}>
                  <code style={{ background: 'var(--code-bg)', padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>{m.syntax}</code>
                  <span>{m.action}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User / Auth button */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => {
              if (user) {
                setShowUserMenu(!showUserMenu)
              } else {
                onSignIn()
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: user ? 'var(--tab-sage)' : 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            title={user ? user.email || 'Account' : 'Sign in'}
          >
            <UserIcon />
          </button>

          {showUserMenu && user && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'var(--panel-bg)',
                borderRadius: '10px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
                padding: '12px 16px',
                width: '220px',
                zIndex: 100,
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
              }}
            >
              <div style={{
                color: 'var(--text-secondary)',
                fontSize: '11px',
                marginBottom: '4px',
              }}>
                Signed in as
              </div>
              <div style={{
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false)
                  onSignOut()
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onToggleVisible}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
          }}
          title="Hide settings"
        >
          <EyeOffIcon />
        </button>
      </div>
    </div>
  )
}
