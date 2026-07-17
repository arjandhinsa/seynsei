import { Link, useNavigate } from 'react-router-dom'
import {
  ArcProgress,
  LevelDisc,
  StreakCounter,
  TierDot,
  XPBar,
  stageLabelForLevel,
} from '../components/progress'
import { SoftCard } from '../components/SoftCard'
import { BreathingLoader } from '../components/BreathingLoader'
import { ChevronRight } from '../components/icons'
import { Wordmark } from '../components/Wordmark'
import { useCurrentUser, useLogout } from '../api/hooks/useAuth'
import { displayNameFor, avatarInitial } from '../lib/displayName'
import { useOverview, useRecommendation } from '../api/hooks/useProgress'
import type {
  DashboardOverview,
  DomainSummary,
  RecentCompletion,
  Recommendation,
  Domain,
} from '../api/types'

const DOMAIN_ACCENT: Record<Domain, string> = {
  social: 'var(--teal)',
  dating: 'var(--rose)',
}

export default function HomeScreen() {
  const overview = useOverview()
  const recommendation = useRecommendation()

  return (
    <div className="paper" style={{ minHeight: '100vh', position: 'relative', color: 'var(--ink)' }}>
      <div
        className="scroll fade-up"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 22px 64px',
        }}
      >
        <TopBar overview={overview.data} />

        {overview.isLoading && <BreathingLoader fullScreen={false} />}

        {overview.isError && (
          <ErrorBlock onRetry={() => overview.refetch()} />
        )}

        {overview.data && (
          <>
            <Greeting overview={overview.data} />
            <LevelCard overview={overview.data} />
            <DomainCardRow domains={overview.data.domain_breakdown} />
            <RecommendationSection
              isLoading={recommendation.isLoading}
              data={recommendation.data ?? null}
            />
            <RecentActivity completions={overview.data.recent_completions} />
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Top bar — wordmark left, avatar + sign-out right
// ─────────────────────────────────────────────────────────────────────
function TopBar({ overview }: { overview: DashboardOverview | undefined }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const me = useCurrentUser()
  const handleSignOut = () => {
    logout()
    navigate('/auth/login', { replace: true })
  }

  const initial = overview
    ? avatarInitial({
        display_name: overview.display_name,
        email: me.data?.email,
      })
    : '·'

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
      }}
    >
      <div>
        <Wordmark size={22} />
        <div
          className="body"
          style={{
            fontSize: 10,
            color: 'var(--ink-3)',
            marginTop: 4,
            letterSpacing: '0.18em',
            textTransform: 'lowercase',
          }}
        >
          social confidence coach
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          to="/profile"
          aria-label="Profile"
          className="tap"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1px solid oklch(from var(--gold) l c h / 0.45)',
            background:
              'radial-gradient(circle at 30% 30%, oklch(from var(--gold) calc(l + 0.02) c h / 0.30) 0%, oklch(from var(--bg-3) l c h) 80%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink)',
            fontFamily: 'var(--display)',
            fontSize: 16,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          {initial}
        </Link>
        <button
          onClick={handleSignOut}
          className="tap"
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Greeting + streak
// ─────────────────────────────────────────────────────────────────────
function Greeting({ overview }: { overview: DashboardOverview }) {
  const me = useCurrentUser()
  const name = displayNameFor({
    display_name: overview.display_name,
    email: me.data?.email,
  })
  return (
    <section
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 26,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          className="display"
          style={{
            fontSize: 28,
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.005em',
          }}
        >
          Welcome back, <span className="display-italic">{name}</span>.
        </h1>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 13.5,
            color: 'var(--ink-2)',
            marginTop: 8,
            lineHeight: 1.5,
            maxWidth: 280,
          }}
        >
          Take a breath. There's no rush.
        </p>
      </div>
      <div style={{ flexShrink: 0, marginTop: 4 }}>
        <StreakCounter
          days={overview.current_streak}
          active={overview.is_streak_active}
        />
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Level + XP card
// ─────────────────────────────────────────────────────────────────────
function LevelCard({ overview }: { overview: DashboardOverview }) {
  const stage = stageLabelForLevel(overview.current_level)
  const completions = overview.total_completions
  const subtitle =
    completions === 0
      ? 'Ready when you are'
      : `${completions} ${completions === 1 ? 'challenge' : 'challenges'} complete`

  return (
    <SoftCard padding={18} radius="var(--r-lg)" style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <LevelDisc level={overview.current_level} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="label">your path</div>
          <div
            className="display"
            style={{
              fontSize: 18,
              color: 'var(--ink)',
              marginTop: 2,
              letterSpacing: '0.005em',
            }}
          >
            The {stage}
          </div>
          <div
            className="body"
            style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}
          >
            {subtitle}
          </div>
        </div>
      </div>
      <XPBar
        current={overview.xp_in_level}
        max={overview.xp_needed_for_level}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 11.5,
          color: 'var(--ink-3)',
        }}
      >
        <span className="body tnum" style={{ color: 'var(--ink-2)' }}>
          {overview.total_xp} <span style={{ color: 'var(--ink-3)' }}>XP</span>
        </span>
        <span className="body tnum">
          {overview.xp_to_next_level} to next
        </span>
      </div>
    </SoftCard>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Two domain cards — social (teal) + dating (rose)
// ─────────────────────────────────────────────────────────────────────
function DomainCardRow({ domains }: { domains: DomainSummary[] }) {
  // Backend returns both domains; sort to ensure stable social-first ordering.
  const social = domains.find((d) => d.domain === 'social')
  const dating = domains.find((d) => d.domain === 'dating')
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 22,
      }}
    >
      {social && <DomainCard summary={social} />}
      {dating && <DomainCard summary={dating} />}
    </div>
  )
}

function DomainCard({ summary }: { summary: DomainSummary }) {
  const navigate = useNavigate()
  const accent = DOMAIN_ACCENT[summary.domain]
  const done = summary.unique_challenges_completed
  const total = summary.total_challenges
  const pct = total > 0 ? (done / total) * 100 : 0
  return (
    <SoftCard
      padding={16}
      radius="var(--r-lg)"
      onClick={() => navigate(`/challenges?domain=${summary.domain}`)}
      style={{
        borderColor: `oklch(from ${accent} l c h / 0.30)`,
        background: `linear-gradient(165deg, oklch(from ${accent} calc(l - 0.36) calc(c + 0.02) h / 0.45) 0%, var(--bg-2) 65%)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -22,
          right: -22,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(circle, oklch(from ${accent} l c h / 0.30) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        className="label"
        style={{ color: `oklch(from ${accent} calc(l + 0.08) c h)`, opacity: 0.95 }}
      >
        {summary.domain}
      </div>
      <div
        className="display"
        style={{
          fontSize: 22,
          color: 'var(--ink)',
          marginTop: 4,
          lineHeight: 1.1,
          letterSpacing: '0.005em',
        }}
      >
        {summary.label}
      </div>

      <div style={{ marginTop: 14, marginBottom: 10 }}>
        <ArcProgress pct={pct} accent={accent} size={52} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          className="display tnum"
          style={{ fontSize: 20, color: 'var(--ink)' }}
        >
          {done}
        </span>
        <span className="body tnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          of {total}
        </span>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: 'var(--ink-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        Wander in <ChevronRight size={11} />
      </div>
    </SoftCard>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Next recommended
// ─────────────────────────────────────────────────────────────────────
function RecommendationSection({
  isLoading,
  data,
}: {
  isLoading: boolean
  data: Recommendation | null
}) {
  if (!isLoading && !data) return null
  return (
    <section style={{ marginBottom: 22 }}>
      <div
        className="label"
        style={{
          marginBottom: 10,
          color: 'var(--gold-2)',
        }}
      >
        next recommended
      </div>
      {isLoading ? (
        <SoftCard padding={18} radius="var(--r-lg)">
          <div
            className="breathe"
            style={{
              height: 14,
              width: '60%',
              background: 'var(--bg-3)',
              borderRadius: 'var(--r-pill)',
            }}
          />
          <div
            className="breathe"
            style={{
              height: 10,
              width: '85%',
              background: 'var(--bg-3)',
              borderRadius: 'var(--r-pill)',
              marginTop: 12,
              opacity: 0.6,
            }}
          />
        </SoftCard>
      ) : (
        data && <RecommendationCard rec={data} />
      )}
    </section>
  )
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const navigate = useNavigate()
  return (
    <SoftCard
      padding={18}
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
          <TierDot tier={rec.tier} size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="display-italic"
            style={{
              fontSize: 19,
              color: 'var(--ink)',
              lineHeight: 1.25,
            }}
          >
            {rec.name}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-2)',
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {rec.reason}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 12,
              fontSize: 11.5,
              color: 'var(--ink-3)',
            }}
          >
            <span className="label">tier {rec.tier}</span>
            <span>·</span>
            <span className="label">{rec.domain}</span>
          </div>
        </div>
        <ChevronRight size={14} color="var(--ink-3)" />
      </div>
    </SoftCard>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Recent activity — last 5 completions, hidden if empty
// ─────────────────────────────────────────────────────────────────────
function RecentActivity({ completions }: { completions: RecentCompletion[] }) {
  const items = completions.slice(0, 5)
  if (items.length === 0) return null
  return (
    <section style={{ marginBottom: 8 }}>
      <div className="label" style={{ marginBottom: 10 }}>
        recent
      </div>
      <SoftCard padding={4} radius="var(--r-md)">
        {items.map((c, i) => (
          <RecentRow key={c.completion_id} completion={c} divider={i > 0} />
        ))}
      </SoftCard>
    </section>
  )
}

function RecentRow({
  completion,
  divider,
}: {
  completion: RecentCompletion
  divider: boolean
}) {
  // Abandoned attempts are shown (honesty beats hiding the pattern) but
  // muted: dimmed row, "set aside" instead of an XP badge, no gold.
  const abandoned = completion.status === 'abandoned'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderTop: divider ? '1px solid var(--line)' : 'none',
        opacity: abandoned ? 0.55 : 1,
      }}
    >
      <TierDot tier={completion.tier} size={10} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          color: abandoned ? 'var(--ink-2)' : 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {completion.challenge_name}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          flexShrink: 0,
          fontFamily: 'var(--body)',
        }}
      >
        {timeAgo(completion.completed_at)}
      </div>
      {abandoned ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            flexShrink: 0,
            fontStyle: 'italic',
          }}
        >
          set aside
        </div>
      ) : (
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--gold-2)',
            flexShrink: 0,
            fontWeight: 600,
          }}
          className="tnum"
        >
          +{completion.xp_earned}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Loading + error blocks
// ─────────────────────────────────────────────────────────────────────
function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ marginTop: 24 }}>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.round(days / 7)}w ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

