import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  useAbandonChallenge,
  useChallengeById,
  useCreateCompletion,
} from '../api/hooks/useChallenges'
import { ApiError } from '../api/client'
import { SoftButton } from '../components/SoftButton'
import { SoftError } from '../components/AuthLayout'
import { SudsSlider } from '../components/SudsSlider'
import { ChevronLeft } from '../components/icons'

type Step = 1 | 2 | 3
const ARM_TIMEOUT_MS = 5000

export default function ChallengeCompleteScreen() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/challenges" replace />

  return <Wizard challengeId={id} />
}

function Wizard({ challengeId }: { challengeId: string }) {
  const navigate = useNavigate()
  const challenge = useChallengeById(challengeId)
  const create = useCreateCompletion(challengeId)
  const abandon = useAbandonChallenge(challengeId)

  const [step, setStep] = useState<Step>(1)
  // null until the user touches the slider — an untouched slider must not
  // produce a rating (see SudsSlider). Continue/Save are gated on non-null.
  const [before, setBefore] = useState<number | null>(null)
  const [after, setAfter] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const submit = async () => {
    try {
      const result = await create.mutateAsync({
        anxiety_before: before,
        anxiety_after: after,
        notes: notes.trim() || null,
      })
      navigate('/celebration', { state: { result }, replace: true })
    } catch {
      // shown via create.isError below
    }
  }

  // Abandoning still records the attempt (with the pre-rating — a high
  // anxiety_before on an abandon is exactly what the progression rules
  // need to see). No XP, no streak; just the honest data point.
  const abandonAttempt = async () => {
    try {
      await abandon.mutateAsync({ anxiety_before: before, notes: null })
      navigate(`/challenges/${challengeId}`, { replace: true })
    } catch {
      // non-blocking: if it fails, the user can just leave via Back
    }
  }

  const errorMessage =
    create.isError
      ? create.error instanceof ApiError
        ? create.error.detail
        : 'Something went wrong saving that. Try again in a moment.'
      : null

  return (
    <div className="paper" style={{ minHeight: '100vh', color: 'var(--ink)' }}>
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 22px 64px',
        }}
      >
        <Link
          to={`/challenges/${challengeId}`}
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

        <StepIndicator step={step} />

        {step === 1 && (
          <StepBefore
            key="step-1"
            value={before}
            onChange={setBefore}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepDoIt
            key="step-2"
            challengeName={challenge.data?.name}
            onConfirm={() => setStep(3)}
            onAbandon={abandonAttempt}
            abandoning={abandon.isPending}
          />
        )}

        {step === 3 && (
          <StepAfter
            key="step-3"
            before={before}
            value={after}
            onChange={setAfter}
            notes={notes}
            onNotesChange={setNotes}
            onSave={submit}
            saving={create.isPending}
            errorMessage={errorMessage}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Step indicator — three thin horizontal bars
// ─────────────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: Step }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        marginTop: 24,
        marginBottom: 36,
      }}
      aria-label={`Step ${step} of 3`}
    >
      {[1, 2, 3].map((n) => {
        const isActive = n === step
        const isPast = n < step
        return (
          <div
            key={n}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 'var(--r-pill)',
              background:
                isActive || isPast
                  ? 'linear-gradient(90deg, oklch(from var(--gold) calc(l - 0.05) c h) 0%, var(--gold) 100%)'
                  : 'var(--bg-3)',
              boxShadow: isActive
                ? '0 0 12px oklch(from var(--gold) l c h / 0.45)'
                : 'none',
              opacity: isPast && !isActive ? 0.55 : 1,
              transition: 'all 0.3s ease',
            }}
          />
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — Before SUDS
// ─────────────────────────────────────────────────────────────────────
function StepBefore({
  value,
  onChange,
  onContinue,
}: {
  value: number | null
  onChange: (v: number) => void
  onContinue: () => void
}) {
  return (
    <div
      className="fade-up"
      style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
    >
      <header>
        <h1
          className="display"
          style={{
            fontSize: 28,
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.005em',
          }}
        >
          Before you begin.
        </h1>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 14.5,
            color: 'var(--ink-2)',
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          How anxious does doing this make you feel right now? 0 is
          completely calm, 10 is the most anxious you get.
        </p>
      </header>
      <SudsSlider value={value} onChange={onChange} />
      <p
        style={{
          fontFamily: 'var(--body)',
          fontSize: 13,
          color: 'var(--ink-3)',
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        You'll rate again straight after, so you can see the two numbers
        side by side.
      </p>
      <SoftButton
        primary
        onClick={onContinue}
        disabled={value === null}
        style={{ marginTop: 16, fontStyle: 'italic' }}
      >
        {value === null ? 'Slide to rate first' : 'Continue'}
      </SoftButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — Do the challenge (two-tap confirm)
// ─────────────────────────────────────────────────────────────────────
function StepDoIt({
  challengeName,
  onConfirm,
  onAbandon,
  abandoning,
}: {
  challengeName: string | undefined
  onConfirm: () => void
  onAbandon: () => void
  abandoning: boolean
}) {
  const [armed, setArmed] = useState(false)
  const armTimer = useRef<number | null>(null)
  // Two-tap confirm on abandoning too — same logic as "I did it", opposite
  // direction. The friction makes it a decision, the wording keeps it kind.
  const [abandonArmed, setAbandonArmed] = useState(false)
  const abandonTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (armTimer.current) {
        window.clearTimeout(armTimer.current)
        armTimer.current = null
      }
      if (abandonTimer.current) {
        window.clearTimeout(abandonTimer.current)
        abandonTimer.current = null
      }
    }
  }, [])

  const onAbandonTap = () => {
    if (abandonArmed) {
      if (abandonTimer.current) {
        window.clearTimeout(abandonTimer.current)
        abandonTimer.current = null
      }
      setAbandonArmed(false)
      onAbandon()
      return
    }
    setAbandonArmed(true)
    abandonTimer.current = window.setTimeout(() => {
      setAbandonArmed(false)
      abandonTimer.current = null
    }, ARM_TIMEOUT_MS)
  }

  const onTap = () => {
    if (armed) {
      if (armTimer.current) {
        window.clearTimeout(armTimer.current)
        armTimer.current = null
      }
      setArmed(false)
      onConfirm()
      return
    }
    setArmed(true)
    armTimer.current = window.setTimeout(() => {
      setArmed(false)
      armTimer.current = null
    }, ARM_TIMEOUT_MS)
  }

  return (
    <div
      className="fade-up"
      style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
    >
      <header>
        <h1
          className="display"
          style={{
            fontSize: 28,
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.005em',
          }}
        >
          Now go.
        </h1>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 14.5,
            color: 'var(--ink-2)',
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          Put the phone away and do it for real. Come straight back and
          rate while it's fresh.
        </p>
      </header>

      {challengeName && (
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <div
            className="label"
            style={{ marginBottom: 4, color: 'var(--ink-3)' }}
          >
            challenge
          </div>
          <div
            className="display-italic"
            style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.3 }}
          >
            {challengeName}
          </div>
        </div>
      )}

      <button
        onClick={onTap}
        className="tap"
        style={{
          padding: '15px 18px',
          width: '100%',
          borderRadius: 'var(--r-pill)',
          background: armed
            ? 'transparent'
            : 'linear-gradient(180deg, oklch(from var(--gold) calc(l - 0.18) c h) 0%, oklch(from var(--gold) calc(l - 0.32) c h) 100%)',
          border: armed
            ? '1px solid oklch(from var(--gold) l c h / 0.85)'
            : '1px solid oklch(from var(--gold) l c h / 0.55)',
          color: armed ? 'var(--gold-2)' : 'var(--ink)',
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          fontSize: 15,
          fontWeight: 400,
          letterSpacing: '0.01em',
          boxShadow: armed
            ? '0 0 0 4px oklch(from var(--gold) l c h / 0.18), 0 0 24px oklch(from var(--gold) l c h / 0.30)'
            : '0 0 28px oklch(from var(--gold) l c h / 0.25)',
          transition: 'all 0.18s ease',
          marginTop: 8,
          cursor: 'pointer',
        }}
      >
        {armed ? 'tap again to confirm' : 'I did it'}
      </button>

      <button
        onClick={onAbandonTap}
        disabled={abandoning}
        className="tap"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '10px 0 0',
          fontFamily: 'var(--body)',
          fontSize: 13,
          color: abandonArmed ? 'var(--ink-2)' : 'var(--ink-3)',
          textDecoration: abandonArmed ? 'none' : 'underline',
          textUnderlineOffset: 3,
          cursor: 'pointer',
          transition: 'color 0.15s ease',
        }}
      >
        {abandoning
          ? 'Noting it…'
          : abandonArmed
            ? "That's okay — tap again to set this one aside. You can come back to it."
            : "I can't do this one right now"}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Step 3 — After SUDS + notes
// ─────────────────────────────────────────────────────────────────────
function StepAfter({
  before,
  value,
  onChange,
  notes,
  onNotesChange,
  onSave,
  saving,
  errorMessage,
}: {
  before: number | null
  value: number | null
  onChange: (v: number) => void
  notes: string
  onNotesChange: (n: string) => void
  onSave: () => void
  saving: boolean
  errorMessage: string | null
}) {
  return (
    <div
      className="fade-up"
      style={{ display: 'flex', flexDirection: 'column', gap: 26 }}
    >
      <header>
        <h1
          className="display"
          style={{
            fontSize: 28,
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.005em',
          }}
        >
          And now?
        </h1>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 14.5,
            color: 'var(--ink-2)',
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          Now that it's done, how anxious do you feel right now? Not about
          doing it again, just in this moment.
          {before !== null && <> You went in at {before}.</>}
        </p>
      </header>

      <SudsSlider value={value} onChange={onChange} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="suds-notes" className="label">
          Anything to remember?
        </label>
        <textarea
          id="suds-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Optional. A line about what happened, or how you felt."
          rows={4}
          style={{
            width: '100%',
            minHeight: 92,
            padding: '12px 14px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            color: 'var(--ink)',
            fontFamily: 'var(--body)',
            fontSize: 14,
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </div>

      {errorMessage && <SoftError message={errorMessage} />}

      <SoftButton
        primary
        onClick={onSave}
        disabled={saving || value === null}
        style={{ fontStyle: 'italic' }}
      >
        {saving ? 'Saving…' : value === null ? 'Slide to rate first' : 'Save'}
      </SoftButton>
    </div>
  )
}
