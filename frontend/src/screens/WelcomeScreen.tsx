import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { SoftButton } from '../components/SoftButton'
import { ChevronLeft } from '../components/icons'
import {
  ChipMultiSelect,
  ComfortScale,
  QuestionHeading,
  SelectList,
} from '../components/PathQuestions'
import {
  FOCUS_OPTIONS,
  TRIGGER_OPTIONS,
  markWelcomed,
  readWelcome,
  writeWelcome,
  type WelcomeAnswers,
} from '../lib/personalization'
import { getAccessToken } from '../api/client'

// Steps: 0 intro · 1 focus · 2 triggers · 3 comfort · 4 closing
const TOTAL_STEPS = 5

export default function WelcomeScreen() {
  const navigate = useNavigate()

  // If somehow authed, don't show the pre-register flow.
  useEffect(() => {
    if (getAccessToken() !== null) {
      navigate('/home', { replace: true })
    }
  }, [navigate])

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<WelcomeAnswers>(
    () => readWelcome() ?? {},
  )

  // Persist to localStorage as the user goes.
  const update = (patch: Partial<WelcomeAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch }
      writeWelcome(next)
      return next
    })
  }

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  const finishToRegister = () => {
    markWelcomed()
    navigate('/auth/register')
  }
  const finishToLogin = () => {
    markWelcomed()
    navigate('/auth/login')
  }
  const skip = () => {
    // Skipping still counts as welcomed; keep whatever was answered so far.
    markWelcomed()
    navigate('/challenges')
  }

  return (
    <AuthLayout showWordmark={false}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Top bar: back + progress dots + skip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
            minHeight: 36,
          }}
        >
          {step > 0 ? (
            <button
              onClick={goBack}
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
              }}
            >
              <ChevronLeft size={14} />
            </button>
          ) : (
            <div style={{ width: 36 }} aria-hidden />
          )}

          <ProgressDots total={TOTAL_STEPS} active={step} />

          <button
            onClick={skip}
            className="tap"
            style={{
              padding: '6px 4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              fontFamily: 'var(--display)',
              fontStyle: 'italic',
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
        </div>

        {/* Step body */}
        <div key={step} className="fade-up" style={{ flex: 1 }}>
          {step === 0 && <IntroStep onBegin={goNext} />}

          {step === 1 && (
            <StepShell>
              <QuestionHeading sub="We'll tune your challenges to this.">
                Where do you want to <span className="display-italic">grow</span>?
              </QuestionHeading>
              <SelectList
                options={FOCUS_OPTIONS}
                value={answers.focus_area}
                onChange={(v) => {
                  update({ focus_area: v })
                  window.setTimeout(goNext, 180)
                }}
              />
            </StepShell>
          )}

          {step === 2 && (
            <StepShell>
              <QuestionHeading sub="Choose the moments that spike your anxiety most.">
                Which moments feel <span className="display-italic">hardest</span>?
              </QuestionHeading>
              <ChipMultiSelect
                options={TRIGGER_OPTIONS}
                value={answers.top_triggers ?? []}
                onChange={(v) => update({ top_triggers: v })}
              />
              <ContinueRow onNext={goNext} />
            </StepShell>
          )}

          {step === 3 && (
            <StepShell>
              <QuestionHeading sub="No wrong answer, just where you are today.">
                Right now, how at <span className="display-italic">ease</span> are
                you socially?
              </QuestionHeading>
              <ComfortScale
                value={answers.comfort_level}
                onChange={(v) => {
                  update({ comfort_level: v })
                  window.setTimeout(goNext, 320)
                }}
              />
              <ContinueRow onNext={goNext} />
            </StepShell>
          )}

          {step === 4 && (
            <ClosingStep
              onCreate={finishToRegister}
              onSignIn={finishToLogin}
            />
          )}
        </div>
      </div>
    </AuthLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────
function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
    </div>
  )
}

function ProgressDots({ total, active }: { total: number; active: number }) {
  return (
    <div
      style={{ display: 'flex', gap: 7, alignItems: 'center' }}
      aria-label={`Step ${active + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === active
        const isPast = i < active
        return (
          <div
            key={i}
            style={{
              width: isActive ? 18 : 6,
              height: 6,
              borderRadius: 'var(--r-pill)',
              background:
                isActive || isPast
                  ? 'var(--gold)'
                  : 'var(--bg-4)',
              opacity: isPast && !isActive ? 0.5 : 1,
              transition: 'all 0.3s ease',
            }}
          />
        )
      })}
    </div>
  )
}

function ContinueRow({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ marginTop: 28 }}>
      <SoftButton primary onClick={onNext}>
        Continue
      </SoftButton>
    </div>
  )
}

function IntroStep({ onBegin }: { onBegin: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <img
        src="/seynsei-mark-white.svg"
        alt=""
        aria-hidden="true"
        style={{ width: 44, height: 44, opacity: 0.9 }}
      />
      <div
        className="display"
        style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-0.01em' }}
      >
        Seynsei
      </div>
      <h1
        className="display"
        style={{
          fontSize: 30,
          margin: 0,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
        }}
      >
        Small brave steps,{' '}
        <span className="display-italic">daily</span>.
      </h1>
      <p
        style={{
          fontFamily: 'var(--body)',
          fontSize: 15,
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        Confidence is built one gentle push at a time. Answer a few quiet
        questions and we'll shape a path that fits you.
      </p>
      <SoftButton primary onClick={onBegin} style={{ marginTop: 12 }}>
        Begin
      </SoftButton>
    </div>
  )
}

function ClosingStep({
  onCreate,
  onSignIn,
}: {
  onCreate: () => void
  onSignIn: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <h1
        className="display"
        style={{
          fontSize: 32,
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-0.005em',
        }}
      >
        We'll shape your path{' '}
        <span className="display-italic">around this</span>.
      </h1>
      <p
        style={{
          fontFamily: 'var(--body)',
          fontSize: 15,
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        Create an account to save your progress and start practising.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 12,
        }}
      >
        <SoftButton primary onClick={onCreate}>
          Create my account
        </SoftButton>
        <button
          onClick={onSignIn}
          className="tap"
          style={{
            padding: '12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-3)',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Already have an account? <span style={{ color: 'var(--gold-2)' }}>Sign in.</span>
        </button>
      </div>
    </div>
  )
}
