import { useEffect, useState } from 'react'

const DEFAULT_MESSAGES = [
  'Take a slow breath in…',
  '…and let it go',
  "No rush. We're nearly there",
  'Notice your shoulders and let them drop',
]

// Rotation cadence, kept in sync with the 8s breath cycle so a message
// spans one full in-and-out breath.
const CYCLE_MS = 8000

interface BreathingLoaderProps {
  messages?: string[]
  fullScreen?: boolean
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])
  return reduced
}

export function BreathingLoader({
  messages = DEFAULT_MESSAGES,
  fullScreen = true,
}: BreathingLoaderProps) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (messages.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length)
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [messages.length])

  const circleSize = fullScreen ? 96 : 56

  const wrapperStyle: React.CSSProperties = fullScreen
    ? {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        color: 'var(--ink-2)',
        padding: '40px 24px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        color: 'var(--ink-2)',
        padding: '28px 20px',
      }

  const content = (
    <div style={wrapperStyle} role="status" aria-live="polite">
      {/* Breathing circle with halo */}
      <div
        style={{
          position: 'relative',
          width: circleSize,
          height: circleSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          aria-hidden
          className={reduced ? undefined : 'breath-halo'}
          style={{
            position: 'absolute',
            inset: -circleSize * 0.28,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, oklch(from var(--gold) l c h / 0.35) 0%, transparent 70%)',
            opacity: reduced ? 0.4 : undefined,
          }}
        />
        <div
          aria-hidden
          className={reduced ? undefined : 'breath-swell'}
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 32% 30%, oklch(from var(--gold) calc(l + 0.06) c h / 0.55) 0%, oklch(from var(--teal) calc(l - 0.10) calc(c - 0.01) h / 0.30) 70%)',
            border: '1px solid oklch(from var(--gold) l c h / 0.40)',
            boxShadow: '0 0 40px oklch(from var(--gold) l c h / 0.22)',
            animation: reduced
              ? 'breath-pulse 4s ease-in-out infinite'
              : undefined,
          }}
        />
      </div>

      {/* Rotating message */}
      <div
        style={{
          minHeight: 24,
          maxWidth: 300,
          textAlign: 'center',
        }}
      >
        <div
          key={reduced ? 'static' : index}
          className={reduced ? undefined : 'fade-up'}
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: fullScreen ? 17 : 14.5,
            lineHeight: 1.4,
            color: 'var(--ink-2)',
            letterSpacing: '0.005em',
          }}
        >
          {messages[index] ?? messages[0]}
        </div>
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="paper-deep"
        style={{ minHeight: '100vh', color: 'var(--ink)' }}
      >
        {content}
      </div>
    )
  }
  return content
}

export default BreathingLoader
