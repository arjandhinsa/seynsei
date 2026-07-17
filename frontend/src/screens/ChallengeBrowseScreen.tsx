import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useChallenges, useCompletions } from '../api/hooks/useChallenges'
import { useRecommendation } from '../api/hooks/useProgress'
import { isAuthed } from '../api/client'
import { SoftCard } from '../components/SoftCard'
import { BreathingLoader } from '../components/BreathingLoader'
import { ChevronLeft, ChevronRight } from '../components/icons'
import { TierDot, tierColor } from '../components/progress'
import type { Challenge, Completion, Domain, Recommendation } from '../api/types'

const DOMAINS: { id: Domain; label: string }[] = [
  { id: 'social', label: 'Social' },
  { id: 'dating', label: 'Dating' },
]

export default function ChallengeBrowseScreen() {
  const [params, setParams] = useSearchParams()
  const rawDomain = params.get('domain')
  const activeDomain: Domain = rawDomain === 'dating' ? 'dating' : 'social'
  const authed = isAuthed()

  const challenges = useChallenges({ domain: activeDomain })
  const completions = useCompletions()
  const recommendation = useRecommendation()

  const completionCounts = useMemo(
    () => countByChallenge(completions.data ?? []),
    [completions.data],
  )

  const setDomain = (next: Domain) => {
    setParams({ domain: next }, { replace: true })
  }

  const pinnedRec =
    recommendation.data && recommendation.data.domain === activeDomain
      ? recommendation.data
      : null

  return (
    <div className="paper" style={{ minHeight: '100vh', color: 'var(--ink)' }}>
      <div
        className="fade-up"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 22px 64px',
        }}
      >
        {authed ? (
          <BackArrow to="/home" />
        ) : (
          <GuestBanner />
        )}

        <div style={{ marginTop: 22 }}>
          <div className="label">practice</div>
          <h1
            className="display"
            style={{
              fontSize: 28,
              margin: '6px 0 0',
              lineHeight: 1.1,
              letterSpacing: '0.005em',
            }}
          >
            Choose what to <span className="display-italic">try</span>.
          </h1>
          <p
            style={{
              fontFamily: 'var(--body)',
              fontSize: 13,
              color: 'var(--ink-2)',
              marginTop: 7,
              lineHeight: 1.5,
            }}
          >
            Pick something just slightly uncomfortable.
          </p>
        </div>

        <DomainToggle active={activeDomain} onChange={setDomain} />

        {pinnedRec && (
          <PinnedRecommendation rec={pinnedRec} />
        )}

        <div style={{ marginTop: 18 }}>
          {challenges.isLoading && (
            <BreathingLoader fullScreen={false} />
          )}
          {challenges.isError && (
            <ErrorBlock onRetry={() => challenges.refetch()} />
          )}
          {challenges.data && challenges.data.length === 0 && (
            <EmptyBlock />
          )}
          {challenges.data && challenges.data.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {challenges.data.map((c) => (
                <ChallengeRow
                  key={c.id}
                  challenge={c}
                  doneCount={completionCounts.get(c.id) ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────
function GuestBanner() {
  return (
    <SoftCard
      padding={16}
      radius="var(--r-lg)"
      style={{
        borderColor: 'oklch(from var(--gold) l c h / 0.30)',
        background:
          'linear-gradient(160deg, oklch(from var(--gold) calc(l - 0.45) calc(c - 0.03) h / 0.22) 0%, var(--bg-2) 75%)',
      }}
    >
      <div
        className="display-italic"
        style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.35 }}
      >
        You're browsing as a guest
      </div>
      <div
        style={{
          fontFamily: 'var(--body)',
          fontSize: 12.5,
          color: 'var(--ink-2)',
          marginTop: 5,
          lineHeight: 1.5,
        }}
      >
        Create an account to start practising and save your progress.
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 14,
        }}
      >
        <Link
          to="/auth/register"
          className="tap"
          style={{
            padding: '9px 18px',
            borderRadius: 'var(--r-pill)',
            background:
              'linear-gradient(180deg, oklch(from var(--gold) calc(l - 0.18) c h) 0%, oklch(from var(--gold) calc(l - 0.32) c h) 100%)',
            border: '1px solid oklch(from var(--gold) l c h / 0.55)',
            color: 'var(--ink)',
            fontFamily: 'var(--display)',
            fontSize: 13.5,
            textDecoration: 'none',
            boxShadow: '0 0 20px oklch(from var(--gold) l c h / 0.2)',
          }}
        >
          Create account
        </Link>
        <Link
          to="/auth/login"
          className="tap"
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 13.5,
            color: 'var(--ink-3)',
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
      </div>
    </SoftCard>
  )
}

function BackArrow({ to }: { to: string }) {
  return (
    <Link
      to={to}
      aria-label="Back"
      className="tap"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid var(--line)',
        background: 'transparent',
        color: 'var(--ink-2)',
        textDecoration: 'none',
      }}
    >
      <ChevronLeft size={14} />
    </Link>
  )
}

function DomainToggle({
  active,
  onChange,
}: {
  active: Domain
  onChange: (d: Domain) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 22, marginTop: 22 }}>
      {DOMAINS.map((t) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`tap${isActive ? ' handline' : ''}`}
            style={{
              padding: '4px 0',
              fontFamily: 'var(--display)',
              fontStyle: isActive ? 'italic' : 'normal',
              fontWeight: 400,
              fontSize: 16,
              color: isActive ? 'var(--ink)' : 'var(--ink-3)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function PinnedRecommendation({ rec }: { rec: Recommendation }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginTop: 22 }}>
      <div
        className="label"
        style={{ marginBottom: 8, color: 'var(--gold-2)' }}
      >
        next recommended
      </div>
      <SoftCard
        padding={16}
        radius="var(--r-lg)"
        onClick={() => navigate(`/challenges/${rec.challenge_id}`)}
        style={{
          borderColor: 'oklch(from var(--gold) l c h / 0.35)',
          background:
            'linear-gradient(160deg, oklch(from var(--gold) calc(l - 0.45) calc(c - 0.03) h / 0.30) 0%, var(--bg-2) 70%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ marginTop: 4 }}>
            <TierDot tier={rec.tier} size={12} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="display-italic"
              style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.3 }}
            >
              {rec.name}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink-2)',
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {rec.reason}
            </div>
          </div>
          <ChevronRight size={13} color="var(--ink-3)" />
        </div>
      </SoftCard>
      <div
        style={{
          marginTop: 16,
          height: 1,
          background: 'var(--line)',
          opacity: 0.6,
        }}
      />
    </div>
  )
}

function ChallengeRow({
  challenge,
  doneCount,
}: {
  challenge: Challenge
  doneCount: number
}) {
  const navigate = useNavigate()
  const accent = tierColor(challenge.tier)
  return (
    <div
      onClick={() => navigate(`/challenges/${challenge.id}`)}
      className="tap"
      role="button"
      tabIndex={0}
      style={{
        position: 'relative',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: '14px 14px 14px 18px',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          background: accent,
          borderRadius: '0 var(--r-pill) var(--r-pill) 0',
          boxShadow: `0 0 8px oklch(from ${accent} l c h / 0.45)`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <TierDot tier={challenge.tier} size={9} />
            <span
              className="label"
              style={{ fontSize: 9.5, color: 'var(--ink-3)' }}
            >
              tier {challenge.tier}
            </span>
          </div>
          <div
            className="display"
            style={{
              fontSize: 17,
              color: 'var(--ink)',
              lineHeight: 1.3,
              letterSpacing: '0.005em',
            }}
          >
            {challenge.name}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-2)',
              marginTop: 5,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {challenge.description}
          </div>
          {doneCount > 0 && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                marginTop: 7,
                fontFamily: 'var(--body)',
              }}
            >
              done {doneCount} {doneCount === 1 ? 'time' : 'times'}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <XPPill amount={challenge.xp_value} accent={accent} />
          <ChevronRight size={13} color="var(--ink-3)" />
        </div>
      </div>
    </div>
  )
}

function XPPill({ amount, accent }: { amount: number; accent: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--r-pill)',
        border: `1px solid oklch(from ${accent} l c h / 0.35)`,
        background: `oklch(from ${accent} l c h / 0.10)`,
        color: 'var(--ink)',
        fontFamily: 'var(--body)',
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
      className="tnum"
    >
      +{amount}{' '}
      <span style={{ color: 'var(--ink-3)', fontWeight: 500, marginLeft: 3 }}>
        xp
      </span>
    </span>
  )
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <SoftCard padding={20} radius="var(--r-lg)">
      <div
        style={{
          fontFamily: 'var(--body)',
          fontSize: 14,
          color: 'var(--ink-2)',
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        Something didn't load. Pull a slow breath and try again.
      </div>
      <button
        onClick={onRetry}
        className="tap"
        style={{
          padding: '10px 16px',
          borderRadius: 'var(--r-pill)',
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink)',
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </SoftCard>
  )
}

function EmptyBlock() {
  return (
    <SoftCard padding={20} radius="var(--r-lg)">
      <div
        className="display-italic"
        style={{ fontSize: 16, color: 'var(--ink-2)' }}
      >
        No challenges in this domain yet.
      </div>
    </SoftCard>
  )
}

function countByChallenge(completions: Completion[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of completions) {
    // abandoned attempts must not inflate the "done N times" badge
    if (c.status !== 'completed') continue
    out.set(c.challenge_id, (out.get(c.challenge_id) ?? 0) + 1)
  }
  return out
}
