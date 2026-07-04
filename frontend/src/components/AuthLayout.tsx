import type { ReactNode } from 'react'
import { Wordmark } from './Wordmark'

interface AuthLayoutProps {
  children: ReactNode
  showWordmark?: boolean
}

export function AuthLayout({ children, showWordmark = true }: AuthLayoutProps) {
  return (
    <div
      className="paper-deep"
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--ink)',
      }}
    >
      <div
        className="fade-up"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          margin: '0 auto',
          padding: '64px 28px 48px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {showWordmark && (
          <header style={{ textAlign: 'center', marginBottom: 56 }}>
            <Wordmark size={38} />
            <div
              className="body"
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                marginTop: 8,
                letterSpacing: '0.18em',
                textTransform: 'lowercase',
              }}
            >
              social confidence coach
            </div>
          </header>
        )}
        {children}
      </div>
    </div>
  )
}

export function SoftError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      style={{
        fontFamily: 'var(--body)',
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--rose-2)',
        background: 'oklch(from var(--rose) l c h / 0.08)',
        border: '1px solid oklch(from var(--rose) l c h / 0.20)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        margin: 0,
      }}
    >
      {message}
    </p>
  )
}
