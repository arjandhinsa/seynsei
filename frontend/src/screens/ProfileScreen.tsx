import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useOverview } from '../api/hooks/useProgress'
import { useAchievementsCatalog } from '../api/hooks/useAchievements'
import { useCurrentUser } from '../api/hooks/useAuth'
import { displayNameFor, avatarInitial } from '../lib/displayName'
import { SoftCard } from '../components/SoftCard'
import { BreathingLoader } from '../components/BreathingLoader'
import { ChevronLeft, ChevronRight, Cog } from '../components/icons'
import {
  ArcProgress,
  LevelDisc,
  TierDot,
  XPBar,
  stageLabelForLevel,
} from '../components/progress'
import type {
  AchievementCatalogEntry,
  DashboardOverview,
  DomainSummary,
  RecentCompletion,
  UnlockedAchievement,
} from '../api/types'

const DOMAIN_ACCENT: Record<string, string> = {
  social: 'var(--teal)',
  dating: 'var(--rose)',
}

export default function ProfileScreen() {
  const overview = useOverview()
  const catalog = useAchievementsCatalog()

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
        <Header />

        {overview.isLoading && <BreathingLoader fullScreen={false} />}

        {overview.isError && (
          <ErrorBlock onRetry={() => overview.refetch()} />
        )}

        {overview.data && (
          <>
            <Identity overview={overview.data} />
            <LevelCard overview={overview.data} />
            <StatStrip overview={overview.data} />
            <DomainBreakdown domains={overview.data.domain_breakdown} />
            <Milestones
              unlocked={overview.data.unlocked}
              unlockedCount={overview.data.unlocked_count}
              totalAchievements={overview.data.total_achievements}
              catalog={catalog.data ?? null}
              catalogError={catalog.isError}
            />
            <RecentPractice completions={overview.data.recent_completions} />
            <PathLink />
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Your path — quiet link card. The editor lives on its own screen so
// Profile stays a clean mirror of progress.
// ─────────────────────────────────────────────────────────────────────
function PathLink() {
  return (
    <Link to="/path" style={{ textDecoration: 'none' }}>
      <SoftCard
        className="tap"
        style={{
          marginTop: 8,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            className="display"
            style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 3 }}
          >
            Your path
          </div>
          <div
            style={{
              fontFamily: 'var(--body)',
              fontSize: 12.5,
              color: 'var(--ink-3)',
              lineHeight: 1.5,
            }}
          >
            What you told us about where you're growing. Edit anytime.
          </div>
        </div>
        <ChevronRight size={13} color="var(--ink-3)" />
      </SoftCard>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────
function Header() {
  const circleStyle = {
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
  } as const
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <Link to="/home" aria-label="Back" className="tap" style={circleStyle}>
          <ChevronLeft size={14} />
        </Link>
        <Link
          to="/settings"
          aria-label="Settings"
          className="tap"
          style={circleStyle}
        >
          <Cog size={16} />
        </Link>
      </div>
      <h1
        className="display"
        style={{
          fontSize: 28,
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.005em',
        }}
      >
        Your <span className="display-italic">path</span>.
      </h1>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Identity block
// ─────────────────────────────────────────────────────────────────────
function Identity({ overview }: { overview: DashboardOverview }) {
  const me = useCurrentUser()
  const name = displayNameFor({
    display_name: overview.display_name,
    email: me.data?.email,
  })
  const initial = avatarInitial({
    display_name: overview.display_name,
    email: me.data?.email,
  })
  return (
    <section
      style={{
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          flexShrink: 0,
          borderRadius: '50%',
          border: '1px solid oklch(from var(--gold) l c h / 0.45)',
          background:
            'radial-gradient(circle at 30% 30%, oklch(from var(--gold) calc(l + 0.04) c h / 0.35) 0%, oklch(from var(--bg-3) l c h) 80%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--display)',
          fontSize: 26,
          color: 'var(--gold-2)',
          boxShadow: '0 0 24px oklch(from var(--gold) l c h / 0.18)',
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="display"
          style={{
            fontSize: 26,
            lineHeight: 1.1,
            color: 'var(--ink)',
            letterSpacing: '-0.005em',
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--body)',
            fontSize: 12.5,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          {overview.total_completions} completions ·{' '}
          {overview.unlocked_count} of {overview.total_achievements}{' '}
          unlocked
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Level card
// ─────────────────────────────────────────────────────────────────────
function LevelCard({ overview }: { overview: DashboardOverview }) {
  const stage = stageLabelForLevel(overview.current_level)
  return (
    <SoftCard padding={16} radius="var(--r-lg)" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 12,
        }}
      >
        <LevelDisc level={overview.current_level} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="label">your path</div>
          <div
            className="display"
            style={{
              fontSize: 17,
              color: 'var(--ink)',
              marginTop: 2,
              letterSpacing: '0.005em',
            }}
          >
            The {stage}
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
          {overview.total_xp}{' '}
          <span style={{ color: 'var(--ink-3)' }}>XP</span>
        </span>
        <span className="body tnum">
          {overview.xp_to_next_level} to next
        </span>
      </div>
    </SoftCard>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Stat strip — current streak, longest streak, days active
// ─────────────────────────────────────────────────────────────────────
function StatStrip({ overview }: { overview: DashboardOverview }) {
  const daysActive = useMemo(() => {
    const seen = new Set<string>()
    for (const c of overview.recent_completions) {
      const day = c.completed_at.slice(0, 10) // YYYY-MM-DD
      if (day) seen.add(day)
    }
    return seen.size
  }, [overview.recent_completions])

  const streakLabel =
    overview.is_streak_active && overview.current_streak > 0
      ? `${overview.current_streak} ${overview.current_streak === 1 ? 'day' : 'days'}`
      : '—'
  const longestLabel =
    overview.longest_streak > 0
      ? `${overview.longest_streak} ${overview.longest_streak === 1 ? 'day' : 'days'}`
      : '—'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: daysActive > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
        gap: 10,
        marginBottom: 22,
      }}
    >
      <StatPill label="current streak" value={streakLabel} />
      <StatPill label="longest streak" value={longestLabel} />
      {daysActive > 0 && (
        <StatPill
          label="days active"
          value={`${daysActive} ${daysActive === 1 ? 'day' : 'days'}`}
        />
      )}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <SoftCard padding={12} radius="var(--r-md)">
      <div
        className="label"
        style={{ color: 'var(--ink-3)', fontSize: 9.5 }}
      >
        {label}
      </div>
      <div
        className="display tnum"
        style={{
          fontSize: 18,
          color: 'var(--ink)',
          marginTop: 4,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </SoftCard>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Domain breakdown
// ─────────────────────────────────────────────────────────────────────
function DomainBreakdown({ domains }: { domains: DomainSummary[] }) {
  const social = domains.find((d) => d.domain === 'social')
  const dating = domains.find((d) => d.domain === 'dating')
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 22,
      }}
    >
      {social && <DomainStatCard summary={social} />}
      {dating && <DomainStatCard summary={dating} />}
    </div>
  )
}

function DomainStatCard({ summary }: { summary: DomainSummary }) {
  const accent = DOMAIN_ACCENT[summary.domain] ?? 'var(--ink-3)'
  const total = summary.total_challenges
  const unique = summary.unique_challenges_completed
  const pct = total > 0 ? (unique / total) * 100 : 0

  let sudsLine: string
  if (summary.avg_suds_reduction === null) {
    sudsLine = 'no rating data yet'
  } else {
    const v = summary.avg_suds_reduction
    sudsLine = `↓ ${v.toFixed(1)} pts avg`
  }

  return (
    <SoftCard
      padding={14}
      radius="var(--r-lg)"
      style={{
        borderColor: `oklch(from ${accent} l c h / 0.28)`,
        background: `linear-gradient(165deg, oklch(from ${accent} calc(l - 0.36) calc(c + 0.02) h / 0.25) 0%, var(--bg-2) 70%)`,
        overflow: 'hidden',
      }}
    >
      <div
        className="label"
        style={{
          color: `oklch(from ${accent} calc(l + 0.08) c h)`,
          opacity: 0.95,
        }}
      >
        {summary.domain}
      </div>
      <div
        className="display"
        style={{
          fontSize: 18,
          color: 'var(--ink)',
          marginTop: 4,
          lineHeight: 1.1,
        }}
      >
        {summary.label}
      </div>

      <div style={{ marginTop: 12, marginBottom: 10 }}>
        <ArcProgress pct={pct} accent={accent} size={42} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span
          className="display tnum"
          style={{ fontSize: 17, color: 'var(--ink)' }}
        >
          {summary.total_completions}
        </span>
        <span
          className="body tnum"
          style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
        >
          completions
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: 'var(--ink-3)',
        }}
      >
        {unique} of {total} unique
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11.5,
          color: 'var(--ink-2)',
          fontFamily: 'var(--body)',
        }}
      >
        {sudsLine}
      </div>
    </SoftCard>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Milestones — unlocked grid + locked preview
// ─────────────────────────────────────────────────────────────────────
function Milestones({
  unlocked,
  unlockedCount,
  totalAchievements,
  catalog,
  catalogError,
}: {
  unlocked: UnlockedAchievement[]
  unlockedCount: number
  totalAchievements: number
  catalog: AchievementCatalogEntry[] | null
  catalogError: boolean
}) {
  const unlockedIds = useMemo(
    () => new Set(unlocked.map((a) => a.id)),
    [unlocked],
  )
  const locked = useMemo(() => {
    if (!catalog) return []
    return catalog
      .filter((a) => !unlockedIds.has(a.id))
      .sort((a, b) => a.condition_value - b.condition_value)
  }, [catalog, unlockedIds])

  return (
    <section style={{ marginBottom: 26 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          className="display"
          style={{ fontSize: 17, color: 'var(--ink)' }}
        >
          Milestones
        </div>
        <div
          className="body tnum"
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
          }}
        >
          {unlockedCount} of {totalAchievements} unlocked
        </div>
      </div>

      {unlocked.length === 0 && (
        <SoftCard
          padding={16}
          radius="var(--r-md)"
          style={{ marginBottom: locked.length > 0 ? 18 : 0 }}
        >
          <div
            className="display-italic"
            style={{ fontSize: 14, color: 'var(--ink-3)' }}
          >
            No milestones unlocked yet.
          </div>
        </SoftCard>
      )}

      {unlocked.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 10,
            marginBottom: locked.length > 0 ? 18 : 0,
          }}
        >
          {unlocked.map((a) => (
            <UnlockedCard key={a.id} achievement={a} />
          ))}
        </div>
      )}

      {!catalogError && locked.length > 0 && (
        <>
          <div
            className="label"
            style={{ marginBottom: 8, color: 'var(--ink-3)' }}
          >
            coming up
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 10,
            }}
          >
            {locked.map((a) => (
              <LockedCard key={a.id} entry={a} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function UnlockedCard({ achievement }: { achievement: UnlockedAchievement }) {
  return (
    <SoftCard
      padding={12}
      radius="var(--r-md)"
      style={{
        borderColor: 'oklch(from var(--gold) l c h / 0.30)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconCircle icon={achievement.icon} active />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="display-italic"
            style={{
              fontSize: 13.5,
              color: 'var(--ink)',
              lineHeight: 1.25,
            }}
          >
            {achievement.name}
          </div>
          {achievement.xp_bonus > 0 && (
            <div
              className="tnum"
              style={{
                marginTop: 3,
                fontSize: 10.5,
                color: 'var(--gold-2)',
                fontWeight: 600,
                fontFamily: 'var(--body)',
              }}
            >
              +{achievement.xp_bonus} XP
            </div>
          )}
        </div>
      </div>
      {achievement.description && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--ink-2)',
            lineHeight: 1.45,
          }}
        >
          {achievement.description}
        </div>
      )}
    </SoftCard>
  )
}

function LockedCard({ entry }: { entry: AchievementCatalogEntry }) {
  const condition = formatCondition(entry)
  return (
    <SoftCard padding={12} radius="var(--r-md)" style={{ opacity: 0.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconCircle icon={entry.icon} />
        <div
          className="display-italic"
          style={{
            fontSize: 13.5,
            color: 'var(--ink-2)',
            lineHeight: 1.25,
            flex: 1,
            minWidth: 0,
          }}
        >
          {entry.name}
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11.5,
          color: 'var(--ink-3)',
          fontFamily: 'var(--body)',
          lineHeight: 1.45,
        }}
      >
        {condition}
      </div>
    </SoftCard>
  )
}

function IconCircle({
  icon,
  active = false,
}: {
  icon: string | null
  active?: boolean
}) {
  return (
    <div
      aria-hidden
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: '50%',
        background: active
          ? 'oklch(from var(--gold) l c h / 0.12)'
          : 'var(--bg-3)',
        border: active
          ? '1px solid oklch(from var(--gold) l c h / 0.30)'
          : '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        lineHeight: 1,
      }}
    >
      {icon ?? '·'}
    </div>
  )
}

function formatCondition(entry: AchievementCatalogEntry): string {
  const v = entry.condition_value
  switch (entry.condition_type) {
    case 'total_completions':
      return `Complete ${v} ${v === 1 ? 'challenge' : 'challenges'}`
    case 'tier_reached':
      return `Reach Tier ${v}`
    case 'streak_days':
      return `${v}-day streak`
    case 'xp_milestone':
      return `Reach ${v} XP`
    case 'challenge_repeat_count':
      return `Repeat one challenge ${v} times`
    case 'domain_balance':
      return `${v} completions in each domain`
    default:
      return entry.description ?? `${entry.condition_type}: ${v}`
  }
}

// ─────────────────────────────────────────────────────────────────────
// Recent practice
// ─────────────────────────────────────────────────────────────────────
function RecentPractice({ completions }: { completions: RecentCompletion[] }) {
  const items = completions.slice(0, 10)
  if (items.length === 0) return null
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        className="display"
        style={{
          fontSize: 17,
          color: 'var(--ink)',
          marginBottom: 12,
        }}
      >
        Recent practice
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
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderTop: divider ? '1px solid var(--line)' : 'none',
      }}
    >
      <TierDot tier={completion.tier} size={10} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          color: 'var(--ink)',
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
      <div
        className="tnum"
        style={{
          fontSize: 11.5,
          color: 'var(--gold-2)',
          flexShrink: 0,
          fontWeight: 600,
        }}
      >
        +{completion.xp_earned}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Loading + error
// ─────────────────────────────────────────────────────────────────────
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
