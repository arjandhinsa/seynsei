import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { AchievementInfo, CompletionResultResponse } from '../api/types'
import { stageLabelForLevel } from '../components/progress'
import { SoftCard } from '../components/SoftCard'
import { SoftButton } from '../components/SoftButton'

const CELEBRATION_KEYFRAMES = `
@keyframes celebration-glow-intro {
  0%   { transform: scale(0.6); opacity: 0; }
  35%  { transform: scale(1.2); opacity: 0.6; }
  100% { transform: scale(1.0); opacity: 0; }
}
@keyframes celebration-glow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.22; }
  50%      { transform: scale(1.06); opacity: 0.40; }
}
@keyframes celebration-petal-drift {
  0%   { transform: translate(0, 0) rotate(0deg);     opacity: 0; }
  8%   { opacity: 0.55; }
  92%  { opacity: 0.55; }
  100% { transform: translate(-110vw, 110vh) rotate(360deg); opacity: 0; }
}
`

export default function CelebrationScreen() {
  const location = useLocation()
  const result = (location.state as { result?: CompletionResultResponse } | null)?.result
  if (!result) return <Navigate to="/home" replace />

  return (
    <div
      className="paper"
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--ink)',
      }}
    >
      <style>{CELEBRATION_KEYFRAMES}</style>

      <Glow />
      <Petal />

      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '120px 22px 56px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Heading result={result} />
        <XPBlock result={result} />
        {result.leveled_up && <LevelUpBlock level={result.level_after} />}
        {result.newly_unlocked.length > 0 && (
          <Unlocks list={result.newly_unlocked} />
        )}
        {result.is_new_personal_best_streak && (
          <StreakCallout days={result.streak_after} />
        )}
        <CTAs completionId={result.completion.id} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Atmosphere — single glow + single petal
// ─────────────────────────────────────────────────────────────────────
function Glow() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        width: 320,
        height: 320,
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* one-shot intro pulse — the "breath out" moment */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, oklch(from var(--gold) l c h / 0.55) 0%, transparent 65%)',
          animation: 'celebration-glow-intro 2s ease-out 1 forwards',
        }}
      />
      {/* continuous quiet pulse, joins after the intro fades */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, oklch(from var(--gold) l c h / 0.30) 0%, transparent 65%)',
          animation: 'celebration-glow-pulse 4.5s ease-in-out 1.5s infinite',
        }}
      />
    </div>
  )
}

function Petal() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: -20,
        right: -20,
        animation: 'celebration-petal-drift 8s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg width={14} height={14} viewBox="0 0 14 14">
        <path
          d="M7 1 Q 12 4, 11 8 Q 9 13, 7 13 Q 5 13, 3 8 Q 2 4, 7 1 Z"
          fill="oklch(85% 0.06 30 / 0.7)"
        />
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Heading + cascading subtitle
// ─────────────────────────────────────────────────────────────────────
function Heading({ result }: { result: CompletionResultResponse }) {
  return (
    <header style={{ textAlign: 'center' }}>
      <h1
        className="display fade-up"
        style={{
          fontSize: 32,
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-0.005em',
        }}
      >
        Well done.
      </h1>
      <p
        className="fade-up"
        style={{
          fontFamily: 'var(--body)',
          fontSize: 14.5,
          color: 'var(--ink-2)',
          marginTop: 12,
          lineHeight: 1.5,
          animationDelay: '0.1s',
        }}
      >
        {subtitleFor(result)}
      </p>
    </header>
  )
}

function subtitleFor(r: CompletionResultResponse): string {
  if (r.leveled_up) return "You've crossed into a new level."
  if (r.is_new_personal_best_streak) return 'A new best streak.'
  if (r.newly_unlocked.length > 0) return 'And a new milestone.'
  if (r.xp_earned >= 100) return 'That took courage.'
  if (r.xp_earned >= 50) return 'That had stake.'
  if (r.xp_earned >= 15) return 'That took presence.'
  return 'Another small step.'
}

// ─────────────────────────────────────────────────────────────────────
// XP block — counts up
// ─────────────────────────────────────────────────────────────────────
function XPBlock({ result }: { result: CompletionResultResponse }) {
  const xp = useCountUp(result.xp_earned, 800, 200)
  return (
    <div style={{ textAlign: 'center', marginTop: 40 }}>
      <div
        className="display tnum"
        style={{
          fontSize: 48,
          color: 'var(--gold)',
          lineHeight: 1,
          letterSpacing: '-0.005em',
        }}
      >
        +{xp} XP
      </div>
      {result.bonus_xp_from_achievements > 0 && (
        <div
          className="display tnum fade-up"
          style={{
            fontSize: 20,
            color: 'var(--gold-2)',
            marginTop: 12,
            animationDelay: '1.2s',
          }}
        >
          +{result.bonus_xp_from_achievements} bonus
        </div>
      )}
      <div
        className="fade-up"
        style={{
          fontFamily: 'var(--body)',
          fontSize: 12,
          color: 'var(--ink-3)',
          marginTop: 14,
          animationDelay: '1.4s',
        }}
      >
        Now at {result.total_xp_after} XP
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Level-up block (conditional)
// ─────────────────────────────────────────────────────────────────────
function LevelUpBlock({ level }: { level: number }) {
  const stage = stageLabelForLevel(level)
  return (
    <div
      className="fade-up"
      style={{
        textAlign: 'center',
        marginTop: 40,
        animationDelay: '1.5s',
      }}
    >
      <div
        className="label"
        style={{
          color: 'var(--gold-2)',
          fontSize: 11,
          letterSpacing: '0.18em',
        }}
      >
        LEVEL {level}
      </div>
      <div
        style={{
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          fontSize: 28,
          marginTop: 10,
          color: 'var(--ink)',
          lineHeight: 1.2,
          letterSpacing: '0.005em',
        }}
      >
        <span className="handline">The {stage}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Achievement unlocks (conditional)
// ─────────────────────────────────────────────────────────────────────
function Unlocks({ list }: { list: AchievementInfo[] }) {
  return (
    <div style={{ marginTop: 40 }}>
      <div
        className="label fade-up"
        style={{
          textAlign: 'center',
          marginBottom: 14,
          color: 'var(--gold-2)',
          animationDelay: '1.7s',
        }}
      >
        {list.length === 1 ? 'milestone unlocked' : 'milestones unlocked'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((a, i) => (
          <SoftCard
            key={a.id}
            padding={14}
            radius="var(--r-md)"
            className="fade-up"
            style={{
              animationDelay: `${1.8 + i * 0.2}s`,
              borderColor: 'oklch(from var(--gold) l c h / 0.30)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                aria-hidden
                style={{
                  fontSize: 24,
                  lineHeight: 1,
                  width: 32,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {a.icon ?? '·'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="display-italic"
                  style={{
                    fontSize: 16,
                    color: 'var(--ink)',
                    lineHeight: 1.25,
                  }}
                >
                  {a.name}
                </div>
                {a.description && (
                  <div
                    style={{
                      fontFamily: 'var(--body)',
                      fontSize: 12.5,
                      color: 'var(--ink-2)',
                      marginTop: 4,
                      lineHeight: 1.45,
                    }}
                  >
                    {a.description}
                  </div>
                )}
              </div>
              {a.xp_bonus > 0 && (
                <span
                  className="tnum"
                  style={{
                    flexShrink: 0,
                    padding: '3px 10px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid oklch(from var(--gold) l c h / 0.35)',
                    background: 'oklch(from var(--gold) l c h / 0.10)',
                    color: 'var(--gold-2)',
                    fontFamily: 'var(--body)',
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  +{a.xp_bonus}
                </span>
              )}
            </div>
          </SoftCard>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Streak callout (conditional)
// ─────────────────────────────────────────────────────────────────────
function StreakCallout({ days }: { days: number }) {
  return (
    <div
      className="fade-up"
      style={{
        textAlign: 'center',
        marginTop: 32,
        fontFamily: 'var(--body)',
        fontStyle: 'italic',
        fontSize: 14,
        color: 'var(--ink-2)',
        animationDelay: '2.2s',
        lineHeight: 1.5,
      }}
    >
      {days} day streak. Your new best
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// CTAs
// ─────────────────────────────────────────────────────────────────────
function CTAs({ completionId }: { completionId: string }) {
  const navigate = useNavigate()
  return (
    <div
      className="fade-up"
      style={{ marginTop: 48, animationDelay: '2.4s' }}
    >
      <SoftButton
        primary
        onClick={() => navigate(`/sensei?completion_id=${completionId}`)}
      >
        Reflect with Sensei →
      </SoftButton>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link
          to="/home"
          replace
          className="tap"
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--ink-2)',
            textDecoration: 'none',
            padding: '6px 4px',
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Hook: ease-out cubic count-up
// ─────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration: number, delay: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target <= 0) {
      setValue(0)
      return
    }
    // Respect prefers-reduced-motion: skip straight to the final value.
    // The CSS reduced-motion rule can't reach this rAF-driven counter.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target)
      return
    }
    let raf = 0
    let startTs: number | null = null
    const startTimer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (startTs === null) startTs = now
        const elapsed = now - startTs
        const t = Math.min(1, elapsed / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setValue(Math.round(target * eased))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(startTimer)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delay])
  return value
}
