import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useChallengeById, useCompletions } from '../api/hooks/useChallenges'
import { isAuthed } from '../api/client'
import { SoftCard } from '../components/SoftCard'
import { SoftButton } from '../components/SoftButton'
import { BreathingLoader } from '../components/BreathingLoader'
import { ChevronLeft, ChevronRight, Lightbulb, Lock } from '../components/icons'
import { TierDot, tierColor } from '../components/progress'
import type { Challenge, Completion } from '../api/types'

const TIER_NAMES: Record<number, string> = {
  1: 'Presence',
  2: 'Scripted',
  3: 'Unscripted',
  4: 'Initiation',
  5: 'Vulnerability',
}

export default function ChallengeDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const authed = isAuthed()
  const { data, isLoading, isError, notFound } = useChallengeById(id)
  const completions = useCompletions()

  const stats = useMemo(
    () => deriveStats(completions.data ?? [], id),
    [completions.data, id],
  )

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
        <BackArrow domain={data?.domain} />

        {isLoading && <BreathingLoader fullScreen={false} />}

        {!isLoading && (isError || notFound) && <NotFoundBlock />}

        {data && <DetailBody challenge={data} stats={stats} authed={authed} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────
function BackArrow({ domain }: { domain?: string }) {
  const to = domain ? `/challenges?domain=${domain}` : '/challenges'
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

interface DetailStats {
  count: number
  bestReduction: number | null
}

function DetailBody({
  challenge,
  stats,
  authed,
}: {
  challenge: Challenge
  stats: DetailStats
  authed: boolean
}) {
  const navigate = useNavigate()
  const accent = tierColor(challenge.tier)
  const tierName = TIER_NAMES[challenge.tier] ?? `Tier ${challenge.tier}`

  return (
    <div style={{ marginTop: 22 }}>
      {/* Tier badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px 4px 8px',
          borderRadius: 'var(--r-pill)',
          border: `1px solid oklch(from ${accent} l c h / 0.30)`,
          background: `oklch(from ${accent} l c h / 0.08)`,
        }}
      >
        <TierDot tier={challenge.tier} size={10} />
        <span
          className="label"
          style={{ fontSize: 10, color: 'var(--ink-2)' }}
        >
          Tier {challenge.tier} · {tierName}
        </span>
      </div>

      {/* Title */}
      <h1
        className="display"
        style={{
          fontSize: 26,
          margin: '14px 0 0',
          lineHeight: 1.2,
          letterSpacing: '0.005em',
        }}
      >
        {challenge.name}
      </h1>

      {/* Description */}
      <p
        style={{
          fontFamily: 'var(--body)',
          fontSize: 15,
          color: 'var(--ink-2)',
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        {challenge.description}
      </p>

      {/* XP indicator */}
      <div
        style={{
          marginTop: 18,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          borderRadius: 'var(--r-pill)',
          border: `1px solid oklch(from ${accent} l c h / 0.35)`,
          background: `oklch(from ${accent} l c h / 0.10)`,
          fontFamily: 'var(--body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink)',
        }}
        className="tnum"
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 8px oklch(from ${accent} l c h / 0.5)`,
          }}
        />
        +{challenge.xp_value}{' '}
        <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>xp</span>
      </div>

      {/* Tip */}
      {challenge.tip && (
        <SoftCard
          padding={16}
          radius="var(--r-md)"
          style={{
            marginTop: 22,
            borderColor: 'oklch(from var(--gold) l c h / 0.30)',
            background:
              'linear-gradient(160deg, oklch(from var(--gold) calc(l - 0.50) calc(c - 0.03) h / 0.18) 0%, var(--bg-2) 75%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span
              style={{
                color: 'var(--gold-2)',
                marginTop: 2,
                flexShrink: 0,
              }}
            >
              <Lightbulb size={14} color="var(--gold-2)" />
            </span>
            <div style={{ flex: 1 }}>
              <div
                className="label"
                style={{ color: 'var(--gold-2)', marginBottom: 4 }}
              >
                Tip
              </div>
              <div
                style={{
                  fontFamily: 'var(--body)',
                  fontSize: 13.5,
                  color: 'var(--ink-2)',
                  lineHeight: 1.55,
                }}
              >
                {challenge.tip}
              </div>
            </div>
          </div>
        </SoftCard>
      )}

      {/* Rationale */}
      {challenge.rationale && (
        <SoftCard
          padding={16}
          radius="var(--r-md)"
          style={{ marginTop: 12 }}
        >
          <div
            className="label"
            style={{ color: 'var(--ink-3)', marginBottom: 4 }}
          >
            Why this helps
          </div>
          <div
            style={{
              fontFamily: 'var(--body)',
              fontSize: 13.5,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
            }}
          >
            {challenge.rationale}
          </div>
        </SoftCard>
      )}

      {/* Per-user stats — authed only */}
      {authed && stats.count > 0 && (
        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid var(--line)',
            fontFamily: 'var(--body)',
            fontSize: 12.5,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          Completed {stats.count} {stats.count === 1 ? 'time' : 'times'}
          {stats.bestReduction !== null &&
            stats.bestReduction > 0 &&
            ` · best reduction ${stats.bestReduction} ${stats.bestReduction === 1 ? 'point' : 'points'}`}
        </div>
      )}

      {/* Primary CTA — locked for guests */}
      {authed ? (
        <div style={{ marginTop: 32 }}>
          <SoftButton
            primary
            onClick={() => navigate(`/challenges/${challenge.id}/complete`)}
          >
            Ready
          </SoftButton>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link
              to={`/sensei?challenge_id=${challenge.id}`}
              className="tap"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 4px',
                fontFamily: 'var(--display)',
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--ink-3)',
                textDecoration: 'none',
                letterSpacing: '0.005em',
              }}
            >
              not ready? talk it through with Sensei
              <ChevronRight size={11} />
            </Link>
          </div>
        </div>
      ) : (
        <LockedCTA />
      )}
    </div>
  )
}

function LockedCTA() {
  return (
    <SoftCard
      padding={22}
      radius="var(--r-lg)"
      style={{
        marginTop: 32,
        textAlign: 'center',
        borderColor: 'oklch(from var(--gold) l c h / 0.28)',
        background:
          'linear-gradient(160deg, oklch(from var(--gold) calc(l - 0.48) calc(c - 0.03) h / 0.18) 0%, var(--bg-2) 78%)',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 46,
          height: 46,
          margin: '0 auto 14px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'oklch(from var(--gold) l c h / 0.10)',
          border: '1px solid oklch(from var(--gold) l c h / 0.35)',
          color: 'var(--gold-2)',
        }}
      >
        <Lock size={20} color="var(--gold-2)" />
      </div>
      <div
        className="display-italic"
        style={{
          fontSize: 18,
          color: 'var(--ink)',
          lineHeight: 1.3,
          marginBottom: 6,
        }}
      >
        Log in to begin this challenge
      </div>
      <div
        style={{
          fontFamily: 'var(--body)',
          fontSize: 13,
          color: 'var(--ink-2)',
          lineHeight: 1.5,
          marginBottom: 20,
          maxWidth: 280,
          margin: '0 auto 20px',
        }}
      >
        An account saves your progress and lets Sensei coach you through it.
      </div>
      <Link
        to="/auth/register"
        className="tap"
        style={{
          display: 'block',
          padding: '15px 18px',
          borderRadius: 'var(--r-pill)',
          background:
            'linear-gradient(180deg, oklch(from var(--gold) calc(l - 0.18) c h) 0%, oklch(from var(--gold) calc(l - 0.32) c h) 100%)',
          border: '1px solid oklch(from var(--gold) l c h / 0.55)',
          color: 'var(--ink)',
          fontFamily: 'var(--display)',
          fontSize: 15,
          textDecoration: 'none',
          boxShadow: '0 0 28px oklch(from var(--gold) l c h / 0.25)',
        }}
      >
        Create free account
      </Link>
      <div style={{ marginTop: 14 }}>
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
          Already have an account? Sign in
        </Link>
      </div>
    </SoftCard>
  )
}

function NotFoundBlock() {
  return (
    <div style={{ marginTop: 28 }}>
      <SoftCard padding={20} radius="var(--r-lg)">
        <div
          className="display-italic"
          style={{ fontSize: 18, color: 'var(--ink)', marginBottom: 10 }}
        >
          We can't find that challenge.
        </div>
        <div
          style={{
            fontFamily: 'var(--body)',
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          It may have been removed or the link is wrong.
        </div>
        <Link
          to="/challenges"
          className="tap"
          style={{
            display: 'inline-flex',
            padding: '10px 16px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink)',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Back to practice
        </Link>
      </SoftCard>
    </div>
  )
}

function deriveStats(completions: Completion[], id: string | undefined): DetailStats {
  if (!id) return { count: 0, bestReduction: null }
  let count = 0
  let bestReduction: number | null = null
  for (const c of completions) {
    if (c.challenge_id !== id) continue
    // /completions now returns abandoned attempts too — they must not
    // inflate the "done N times" count or the best-reduction stat.
    if (c.status !== 'completed') continue
    count += 1
    if (c.anxiety_before != null && c.anxiety_after != null) {
      const reduction = c.anxiety_before - c.anxiety_after
      if (bestReduction === null || reduction > bestReduction) {
        bestReduction = reduction
      }
    }
  }
  return { count, bestReduction }
}
