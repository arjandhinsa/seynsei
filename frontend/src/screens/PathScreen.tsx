import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useUpdateMe } from '../api/hooks/useAuth'
import { ApiError } from '../api/client'
import { SoftError } from '../components/AuthLayout'
import { BreathingLoader } from '../components/BreathingLoader'
import { ChevronLeft } from '../components/icons'
import {
  ChipMultiSelect,
  ComfortScale,
  SelectList,
} from '../components/PathQuestions'
import {
  FOCUS_OPTIONS,
  TRIGGER_OPTIONS,
} from '../lib/personalization'
import type { FocusArea, TriggerCode, UserResponse } from '../api/types'

// ─────────────────────────────────────────────────────────────────────
// Your path — the answers from the welcome flow, editable anytime.
// Lives on its own screen so Profile stays a clean mirror of progress.
// ─────────────────────────────────────────────────────────────────────
export default function PathScreen() {
  const me = useCurrentUser()

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
        <Link
          to="/profile"
          aria-label="Back to profile"
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

        <h1
          className="display"
          style={{
            fontSize: 26,
            margin: '22px 0 6px',
            lineHeight: 1.15,
          }}
        >
          Your path
        </h1>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            marginTop: 0,
            marginBottom: 24,
          }}
        >
          What you told us about where you're growing. It shapes how Sensei
          coaches you and which challenges come first. Change it anytime.
        </p>

        {me.isLoading && <BreathingLoader fullScreen={false} />}
        {me.data && <PathEditor me={me.data} />}
      </div>
    </div>
  )
}

function PathEditor({ me }: { me: UserResponse }) {
  const updateMe = useUpdateMe()

  const [focus, setFocus] = useState<FocusArea | undefined>(
    me.focus_area ?? undefined,
  )
  const [triggers, setTriggers] = useState<TriggerCode[]>(
    me.top_triggers ?? [],
  )
  const [comfort, setComfort] = useState<number | undefined>(
    me.comfort_level ?? undefined,
  )
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Re-sync from cache when the user record changes elsewhere.
  useEffect(() => {
    setFocus(me.focus_area ?? undefined)
    setTriggers(me.top_triggers ?? [])
    setComfort(me.comfort_level ?? undefined)
  }, [me.focus_area, me.top_triggers, me.comfort_level])

  const dirty =
    focus !== (me.focus_area ?? undefined) ||
    comfort !== (me.comfort_level ?? undefined) ||
    !sameTriggers(triggers, me.top_triggers ?? [])

  const canSave = dirty && !updateMe.isPending

  const onSave = async () => {
    if (!canSave) return
    try {
      await updateMe.mutateAsync({
        focus_area: focus ?? null,
        top_triggers: triggers,
        comfort_level: comfort ?? null,
      })
      setSavedAt(Date.now())
      window.setTimeout(() => setSavedAt(null), 2200)
    } catch {
      // surfaced via updateMe.isError
    }
  }

  const errorMessage = updateMe.isError
    ? updateMe.error instanceof ApiError
      ? updateMe.error.detail
      : 'Could not save right now.'
    : null

  return (
    <section>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PathField label="Where you want to grow">
          <SelectList options={FOCUS_OPTIONS} value={focus} onChange={setFocus} />
        </PathField>

        <PathField label="Moments that feel hardest">
          <ChipMultiSelect
            options={TRIGGER_OPTIONS}
            value={triggers}
            onChange={setTriggers}
          />
        </PathField>

        <PathField label="How at ease you feel">
          <ComfortScale value={comfort} onChange={setComfort} />
        </PathField>
      </div>

      {errorMessage && (
        <div style={{ marginTop: 16 }}>
          <SoftError message={errorMessage} />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 18,
        }}
      >
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="tap"
          style={{
            padding: '12px 22px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid oklch(from var(--gold) l c h / 0.55)',
            background: canSave
              ? 'linear-gradient(180deg, oklch(from var(--gold) calc(l - 0.18) c h) 0%, oklch(from var(--gold) calc(l - 0.32) c h) 100%)'
              : 'transparent',
            color: canSave ? 'var(--ink)' : 'var(--ink-3)',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 14,
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.55,
          }}
        >
          {updateMe.isPending ? 'Saving…' : 'Save path'}
        </button>
        {savedAt && (
          <span
            key={savedAt}
            className="fade-up"
            style={{
              fontFamily: 'var(--display)',
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--gold-2)',
            }}
          >
            Saved.
          </span>
        )}
      </div>
    </section>
  )
}

function PathField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 10, color: 'var(--ink-2)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function sameTriggers(a: TriggerCode[], b: TriggerCode[]): boolean {
  if (a.length !== b.length) return false
  const bs = new Set(b)
  return a.every((t) => bs.has(t))
}
