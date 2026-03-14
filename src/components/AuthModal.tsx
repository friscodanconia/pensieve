import { useState } from 'react'
import type { AuthState } from '../hooks/useAuth'

interface AuthModalProps {
  auth: AuthState
  onClose: () => void
}

export default function AuthModal({ auth, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = mode === 'signin'
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password)

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setSignupSuccess(true)
    } else {
      onClose()
    }
  }

  const handleGoogle = async () => {
    setError(null)
    const result = await auth.signInWithGoogle()
    if (result.error) setError(result.error)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 100,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '360px',
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--panel-bg)',
          borderRadius: '14px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
          padding: '32px',
          zIndex: 101,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '4px',
        }}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}>
          {mode === 'signin'
            ? 'Sign in to sync your notes across devices.'
            : 'Sign up to save your notes in the cloud.'}
        </p>

        {signupSuccess ? (
          <div style={{
            padding: '16px',
            background: 'var(--tab-sage-light)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
          }}>
            Check your email for a confirmation link, then sign in.
          </div>
        ) : (
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                  outline: 'none',
                  marginBottom: '10px',
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                  outline: 'none',
                  marginBottom: '16px',
                }}
              />

              {error && (
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--tab-coral-light)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--tab-coral)',
                  marginBottom: '12px',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading ? 'var(--text-muted)' : 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                onClick={() => { setMode('signup'); setError(null); setSignupSuccess(false) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--tab-coral)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: "'Inter', sans-serif",
                  textDecoration: 'underline',
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('signin'); setError(null); setSignupSuccess(false) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--tab-coral)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: "'Inter', sans-serif",
                  textDecoration: 'underline',
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '18px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          x
        </button>
      </div>
    </>
  )
}
