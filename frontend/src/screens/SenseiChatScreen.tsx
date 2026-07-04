import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useConversationMessages,
  useResumeRecent,
  useSendMessage,
  useStartConversation,
} from '../api/hooks/useSensei'
import { ChevronLeft } from '../components/icons'
import { ApiError, apiFetch } from '../api/client'
import { SoftError } from '../components/AuthLayout'
import { BreathingLoader } from '../components/BreathingLoader'
import type { ChatMessage, ConversationDetailResponse } from '../api/types'

// Quick replies — always visible above the input. Three sets keyed to entry
// mode so the pills read as the user's likely state of mind: nervous before,
// processing after, open-ended for bare /sensei.
const CHALLENGE_REPLIES = [
  "I'm feeling nervous about this",
  'What if it goes wrong?',
  'I need a smaller first step',
  'Why does this scare me?',
  'Talk me through it',
] as const

const COMPLETION_REPLIES = [
  'It went better than I expected',
  'It went worse than I expected',
  'I want to tell you what happened',
  "I'm not sure how to feel about it",
  "I don't think I did it right",
] as const

const GENERIC_REPLIES = [
  "I'm feeling anxious",
  'I want to talk something through',
  'Why does this scare me?',
  'I need a smaller first step',
  "I'm not sure where to start",
] as const

type QuickReply = string

const KEYFRAMES = `
@keyframes sensei-dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
  40%           { opacity: 1;   transform: scale(1); }
}
`

export default function SenseiChatScreen() {
  const [params] = useSearchParams()
  const challengeId = params.get('challenge_id')
  const completionId = params.get('completion_id')
  const isBare = !challengeId && !completionId

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadingInit, setLoadingInit] = useState(true)
  const [initOpenAIPending, setInitOpenAIPending] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const initStarted = useRef(false)

  const recent = useResumeRecent(isBare)
  const recentId = isBare ? recent.data?.conversation_id ?? null : null
  const loadedMessages = useConversationMessages(recentId)
  const startConversation = useStartConversation()
  const sendMessage = useSendMessage(conversationId)

  // Init: challenge or completion mode → start a fresh conversation.
  //
  // We bypass useMutation here and call apiFetch directly so we don't
  // depend on the mutation observer's lifecycle. The `initStarted` ref
  // guards against the StrictMode double-effect re-firing the request.
  // We deliberately do NOT use a cancellation flag in cleanup: StrictMode's
  // simulated cleanup would set it to true and the response would be
  // dropped, even though the component instance is still alive. setState
  // on a truly unmounted component is harmless (React logs a warning but
  // doesn't crash); StrictMode dev keeps the instance live.
  useEffect(() => {
    if (initStarted.current) return
    if (!challengeId && !completionId) return
    initStarted.current = true
    setInitOpenAIPending(true)
    console.log('[sensei] init starting', { challengeId, completionId })

    apiFetch<ConversationDetailResponse>('/conversations/', {
      method: 'POST',
      body: JSON.stringify({
        challenge_id: challengeId,
        completion_id: completionId,
      }),
    })
      .then((data) => {
        console.log('[sensei] init received data', data)
        setConversationId(data.id)
        setMessages(data.messages)
      })
      .catch((err: unknown) => {
        console.error('[sensei] init error', err)
        const detail =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : 'Something went wrong starting the chat.'
        setInitError(detail)
      })
      .finally(() => {
        console.log('[sensei] init complete')
        setInitOpenAIPending(false)
        setLoadingInit(false)
      })
  }, [challengeId, completionId])

  // Init: bare mode → resume most recent if any, else empty state
  useEffect(() => {
    if (initStarted.current) return
    if (!isBare) return
    if (recent.isLoading) return

    if (!recentId) {
      initStarted.current = true
      setLoadingInit(false)
      return
    }
    if (loadedMessages.isLoading) return

    initStarted.current = true
    if (loadedMessages.data) {
      setConversationId(recentId)
      setMessages(loadedMessages.data)
    }
    setLoadingInit(false)
  }, [isBare, recent.isLoading, recentId, loadedMessages.isLoading, loadedMessages.data])

  // Auto-scroll to bottom on new messages or pending changes
  const bottomRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, sendMessage.isPending, startConversation.isPending])

  const send = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    if (conversationId) {
      // Established conversation: optimistic user bubble, then real coach reply
      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setDraft('')

      sendMessage.mutate(trimmed, {
        onSuccess: (msg) => setMessages((prev) => [...prev, msg]),
      })
      return
    }

    if (isBare) {
      // Bare /sensei first send: create the conversation with this as opener
      const localUserMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      }
      setMessages([localUserMsg])
      setDraft('')

      startConversation.mutate(
        { first_message: trimmed },
        {
          onSuccess: (data) => {
            setConversationId(data.id)
            setMessages(data.messages)
          },
        },
      )
    }
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    send(draft)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(draft)
    }
  }

  const replies: readonly QuickReply[] = challengeId
    ? CHALLENGE_REPLIES
    : completionId
      ? COMPLETION_REPLIES
      : GENERIC_REPLIES

  const showEmptyState =
    !loadingInit &&
    messages.length === 0 &&
    !sendMessage.isPending &&
    !startConversation.isPending &&
    !initOpenAIPending

  const pending =
    sendMessage.isPending || startConversation.isPending || initOpenAIPending
  const mutationError = sendMessage.error ?? startConversation.error
  const errorMessage =
    initError ??
    (mutationError instanceof ApiError
      ? mutationError.detail
      : mutationError
        ? mutationError.message
        : null)

  return (
    <div
      className="paper-deep"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--ink)',
      }}
    >
      <style>{KEYFRAMES}</style>

      <Header challengeId={challengeId} />

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 22px 8px',
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {loadingInit && (
          initOpenAIPending ? (
            <SenseiThinkingPill />
          ) : (
            <div style={{ minHeight: 320 }}>
              <BreathingLoader fullScreen={false} />
            </div>
          )
        )}

        {showEmptyState && <EmptyState />}

        {!loadingInit && messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} />
            ))}
            {pending && <PendingBubble />}
          </div>
        )}

        <div ref={bottomRef} style={{ height: 1 }} />
      </main>

      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          background:
            'linear-gradient(180deg, transparent 0%, var(--bg) 12%)',
          paddingTop: 6,
          paddingBottom: 14,
        }}
      >
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 22px' }}>
          <QuickReplies
            replies={replies}
            onPick={(p) => send(p)}
            disabled={pending}
          />
          {errorMessage && (
            <div style={{ marginBottom: 10 }}>
              <SoftError message={errorMessage} />
            </div>
          )}
          <form
            onSubmit={onSubmit}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type to Sensei…"
              rows={1}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 140,
                padding: '11px 14px',
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                color: 'var(--ink)',
                fontFamily: 'var(--body)',
                fontSize: 14,
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
              }}
            />
            <SendButton disabled={!draft.trim() || pending} />
          </form>
        </div>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Header — back to /home, Sensei wordmark, optional back-to-challenge pill
// ─────────────────────────────────────────────────────────────────────
function Header({ challengeId }: { challengeId: string | null }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background:
          'linear-gradient(180deg, var(--bg) 0%, oklch(from var(--bg) l c h / 0.92) 100%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '14px 22px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Link
          to="/home"
          aria-label="Back to home"
          className="tap"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1px solid var(--line)',
            color: 'var(--ink-2)',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={14} />
        </Link>
        <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
          <div
            className="display"
            style={{ fontSize: 18, lineHeight: 1.1, letterSpacing: '-0.005em' }}
          >
            Sensei
          </div>
          <div
            className="body"
            style={{
              fontSize: 10,
              color: 'var(--ink-3)',
              letterSpacing: '0.18em',
              textTransform: 'lowercase',
              marginTop: 3,
            }}
          >
            your coach
          </div>
        </div>
        {challengeId ? (
          <Link
            to={`/challenges/${challengeId}`}
            replace
            className="tap"
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--line)',
              fontFamily: 'var(--display)',
              fontStyle: 'italic',
              fontSize: 11.5,
              color: 'var(--ink-2)',
              textDecoration: 'none',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            ← challenge
          </Link>
        ) : (
          <div style={{ width: 36, flexShrink: 0 }} aria-hidden />
        )}
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: 10,
        alignItems: 'flex-end',
      }}
    >
      {!isUser && <SenseiAvatar />}
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isUser ? 'var(--r-md)' : 'var(--r-lg)',
          background: isUser
            ? 'transparent'
            : 'oklch(from var(--gold) l c h / 0.08)',
          border: isUser
            ? '1px solid oklch(from var(--teal) l c h / 0.32)'
            : '1px solid oklch(from var(--gold) l c h / 0.22)',
          color: 'var(--ink)',
          fontFamily: 'var(--body)',
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}

function SenseiAvatar() {
  return (
    <div
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 30% 30%, oklch(from var(--gold) calc(l + 0.04) c h / 0.40) 0%, oklch(from var(--bg-3) l c h) 80%)',
        border: '1px solid oklch(from var(--gold) l c h / 0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--display)',
        fontStyle: 'italic',
        fontSize: 13,
        color: 'var(--gold-2)',
        marginBottom: 2,
      }}
    >
      S
    </div>
  )
}

function PendingBubble() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        gap: 10,
        alignItems: 'flex-end',
      }}
    >
      <SenseiAvatar />
      <div
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--r-lg)',
          background: 'oklch(from var(--gold) l c h / 0.08)',
          border: '1px solid oklch(from var(--gold) l c h / 0.22)',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--ink-3)',
              animation: 'sensei-dot-pulse 1.2s ease-in-out infinite',
              animationDelay: `${delay}s`,
              display: 'inline-block',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Empty + loading
// ─────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      style={{
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="display-italic fade-up"
        style={{
          fontSize: 22,
          color: 'var(--ink-2)',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        What's on your mind?
      </div>
    </div>
  )
}

// Slow path — OpenAI call. Mirrors the SoftButton primary style so it
// reads as "the page is doing work" rather than a frozen ellipsis.
function SenseiThinkingPill() {
  return (
    <div
      style={{
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="breathe"
        role="status"
        aria-live="polite"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '14px 22px',
          borderRadius: 'var(--r-pill)',
          border: '1px solid oklch(from var(--gold) l c h / 0.45)',
          background: 'oklch(from var(--gold) l c h / 0.08)',
          boxShadow: '0 0 28px oklch(from var(--gold) l c h / 0.18)',
          color: 'var(--gold-2)',
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          fontSize: 15,
          letterSpacing: '0.005em',
        }}
      >
        Sensei is gathering thoughts…
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Quick replies — universal strip, always visible above the input
// ─────────────────────────────────────────────────────────────────────
function QuickReplies({
  replies,
  onPick,
  disabled,
}: {
  replies: readonly QuickReply[]
  onPick: (p: string) => void
  disabled: boolean
}) {
  return (
    <div
      className="scroll"
      onWheel={(e) => {
        // Mouse wheel → horizontal scroll on this strip.
        // Trackpads already do horizontal natively, so only intercept when
        // vertical intent dominates.
        if (e.deltaY !== 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.currentTarget.scrollLeft += e.deltaY
        }
      }}
      style={{
        display: 'flex',
        gap: 7,
        overflowX: 'auto',
        paddingBottom: 10,
      }}
    >
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onPick(reply)}
          disabled={disabled}
          className="tap"
          style={{
            flexShrink: 0,
            padding: '6px 14px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line-strong)',
            background: 'transparent',
            color: 'var(--ink-2)',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 13,
            whiteSpace: 'nowrap',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {reply}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Send button — small paper-plane icon
// ─────────────────────────────────────────────────────────────────────
function SendButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label="Send"
      className="tap"
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1px solid oklch(from var(--gold) l c h / 0.40)',
        background: disabled
          ? 'transparent'
          : 'linear-gradient(180deg, oklch(from var(--gold) calc(l - 0.18) c h) 0%, oklch(from var(--gold) calc(l - 0.32) c h) 100%)',
        color: disabled ? 'var(--ink-3)' : 'var(--ink)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: disabled
          ? 'none'
          : '0 0 18px oklch(from var(--gold) l c h / 0.30)',
        transition: 'all 0.18s ease',
      }}
    >
      <PaperPlane size={16} />
    </button>
  )
}

function PaperPlane({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M14.5 1.5 L 1.5 7 L 6.5 8.5 L 8.5 14.5 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M6.5 8.5 L 14.5 1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
