import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  useCurrentUser,
  useDeleteMe,
  useLogout,
  useUpdateMe,
} from '../api/hooks/useAuth'
import { SoftCard } from '../components/SoftCard'
import { SoftError } from '../components/AuthLayout'
import { SoftButton } from '../components/SoftButton'
import { SoftInput } from '../components/SoftInput'
import { BreathingLoader } from '../components/BreathingLoader'
import { ChevronLeft } from '../components/icons'

const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.2.0'

export default function SettingsScreen() {
  const me = useCurrentUser()

  return (
    <div className="paper" style={{ minHeight: '100vh', color: 'var(--ink)' }}>
      <div
        className="fade-up"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 22px 48px',
        }}
      >
        <Header />
        {me.data ? (
          <Body
            email={me.data.email}
            displayName={me.data.display_name ?? ''}
          />
        ) : (
          <BreathingLoader fullScreen={false} />
        )}
        <Footer />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Header — back arrow + title
// ─────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div style={{ marginBottom: 26 }}>
      <Link
        to="/profile"
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
          marginBottom: 18,
        }}
      >
        <ChevronLeft size={14} />
      </Link>
      <h1
        className="display"
        style={{
          fontSize: 28,
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.005em',
        }}
      >
        Settings
      </h1>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Body — name section, account section, future placeholders
// ─────────────────────────────────────────────────────────────────────
function Body({
  email,
  displayName,
}: {
  email: string
  displayName: string
}) {
  return (
    <>
      <NameSection initial={displayName} />
      <AccountSection email={email} />
      <ComingSoon />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Name — edit display name with inline saved confirmation
// ─────────────────────────────────────────────────────────────────────
function NameSection({ initial }: { initial: string }) {
  const updateMe = useUpdateMe()
  const [value, setValue] = useState(initial)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const savedTimer = useRef<number | null>(null)

  // Re-sync when the user's name changes from elsewhere (cache invalidation,
  // or after a successful save populates a new initial value).
  useEffect(() => {
    setValue(initial)
  }, [initial])

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    }
  }, [])

  const trimmed = value.trim()
  const dirty = trimmed !== initial.trim()
  const canSave = dirty && !updateMe.isPending

  const onSave = async () => {
    if (!canSave) return
    try {
      await updateMe.mutateAsync({ display_name: trimmed || null })
      setSavedAt(Date.now())
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSavedAt(null), 2000)
    } catch {
      // surfaced via updateMe.isError
    }
  }

  const errorMessage =
    updateMe.isError
      ? updateMe.error instanceof ApiError
        ? updateMe.error.detail
        : 'Could not save right now.'
      : null

  return (
    <section style={{ marginBottom: 30 }}>
      <SectionLabel>Your name</SectionLabel>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SoftInput
            label="Display name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your name"
            maxLength={100}
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="tap"
          style={{
            padding: '12px 18px',
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
            flexShrink: 0,
            opacity: canSave ? 1 : 0.55,
          }}
        >
          {updateMe.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {savedAt && (
        <div
          key={savedAt}
          className="fade-up"
          style={{
            marginTop: 10,
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--gold-2)',
          }}
        >
          Saved.
        </div>
      )}
      {errorMessage && (
        <div style={{ marginTop: 10 }}>
          <SoftError message={errorMessage} />
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Account — email (static) + sign out + delete account
// ─────────────────────────────────────────────────────────────────────
function AccountSection({ email }: { email: string }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const onSignOut = () => {
    logout()
    navigate('/auth/login', { replace: true })
  }

  return (
    <section style={{ marginBottom: 30 }}>
      <SectionLabel>Account</SectionLabel>
      <SoftCard padding={16} radius="var(--r-md)" style={{ marginBottom: 14 }}>
        <div className="label" style={{ color: 'var(--ink-3)' }}>
          Email
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: 'var(--body)',
            fontSize: 14,
            color: 'var(--ink)',
            wordBreak: 'break-all',
          }}
        >
          {email}
        </div>
      </SoftCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SoftButton onClick={onSignOut}>Sign out</SoftButton>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="tap"
          style={{
            padding: '15px 18px',
            width: '100%',
            borderRadius: 'var(--r-pill)',
            border: '1px solid oklch(from var(--rose) l c h / 0.45)',
            background: 'transparent',
            color: 'var(--rose-2)',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 15,
            letterSpacing: '0.01em',
            cursor: 'pointer',
          }}
        >
          Delete account
        </button>
      </div>
      {confirmingDelete && (
        <DeleteConfirm onClose={() => setConfirmingDelete(false)} />
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Delete confirmation overlay (z-indexed flex, no position:fixed —
// matches the rest of the app's no-fixed-positioning approach).
// ─────────────────────────────────────────────────────────────────────
function DeleteConfirm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const deleteMe = useDeleteMe()

  const errorMessage =
    deleteMe.isError
      ? deleteMe.error instanceof ApiError
        ? deleteMe.error.detail
        : 'Could not delete the account. Try again in a moment.'
      : null

  const onConfirm = async () => {
    try {
      await deleteMe.mutateAsync()
      logout() // clears tokens + query cache
      navigate('/auth/register', { replace: true })
    } catch {
      // surfaced via deleteMe.isError
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: 'oklch(from var(--bg) l c h / 0.88)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 22px',
      }}
    >
      <div
        className="fade-up"
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--bg-2)',
          border: '1px solid oklch(from var(--rose) l c h / 0.30)',
          borderRadius: 'var(--r-lg)',
          padding: 22,
          boxShadow: '0 16px 48px oklch(0% 0 0 / 0.45)',
        }}
      >
        <h2
          id="delete-confirm-title"
          className="display"
          style={{
            fontSize: 22,
            margin: 0,
            lineHeight: 1.2,
            letterSpacing: '-0.005em',
          }}
        >
          Delete your account?
        </h2>
        <p
          style={{
            marginTop: 12,
            fontFamily: 'var(--body)',
            fontSize: 13.5,
            color: 'var(--ink-2)',
            lineHeight: 1.55,
          }}
        >
          This is permanent. Your completions, conversations with Sensei, and
          progress will be gone. There is no undo.
        </p>
        {errorMessage && (
          <div style={{ marginTop: 14 }}>
            <SoftError message={errorMessage} />
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginTop: 22,
          }}
        >
          <SoftButton
            primary
            onClick={onClose}
            disabled={deleteMe.isPending}
          >
            Keep my account
          </SoftButton>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleteMe.isPending}
            className="tap"
            style={{
              padding: '15px 18px',
              width: '100%',
              borderRadius: 'var(--r-pill)',
              border: '1px solid oklch(from var(--rose) l c h / 0.55)',
              background: 'transparent',
              color: 'var(--rose-2)',
              fontFamily: 'var(--display)',
              fontStyle: 'italic',
              fontSize: 15,
              letterSpacing: '0.01em',
              cursor: deleteMe.isPending ? 'not-allowed' : 'pointer',
              opacity: deleteMe.isPending ? 0.6 : 1,
            }}
          >
            {deleteMe.isPending ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Coming soon — quiet placeholder list, not interactive
// ─────────────────────────────────────────────────────────────────────
const COMING_SOON = [
  'Change avatar lineage',
  'Notification preferences',
  'Export your data',
] as const

function ComingSoon() {
  return (
    <section style={{ marginBottom: 30 }}>
      <SectionLabel muted>Coming soon</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {COMING_SOON.map((item) => (
          <div
            key={item}
            style={{
              padding: '12px 14px',
              background: 'var(--bg-2)',
              borderRadius: 'var(--r-md)',
              fontFamily: 'var(--display)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--ink-3)',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Footer — version line
// ─────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <div
      style={{
        textAlign: 'center',
        marginTop: 40,
        fontFamily: 'var(--body)',
        fontSize: 11,
        color: 'var(--ink-3)',
        letterSpacing: '0.04em',
      }}
    >
      Seynsei v{APP_VERSION}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function SectionLabel({
  children,
  muted = false,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <div
      className="label"
      style={{
        marginBottom: 12,
        color: muted ? 'var(--ink-3)' : 'var(--ink-2)',
      }}
    >
      {children}
    </div>
  )
}

