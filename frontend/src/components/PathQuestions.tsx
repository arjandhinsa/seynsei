import type { ReactNode } from 'react'
import {
  COMFORT_ANCHORS,
  MAX_TRIGGERS,
} from '../lib/personalization'

// ─────────────────────────────────────────────────────────────────────
// Shared personalization controls — used by the Welcome flow and the
// Profile "Your path" editor so the two never drift apart.
// ─────────────────────────────────────────────────────────────────────

interface Option<T extends string> {
  code: T
  label: string
  hint?: string
}

// Single-select stacked cards (focus area, goal).
export function SelectList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[]
  value: T | undefined
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((opt) => {
        const active = value === opt.code
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            className="tap"
            aria-pressed={active}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 3,
              width: '100%',
              textAlign: 'left',
              padding: '15px 18px',
              borderRadius: 'var(--r-md)',
              background: active
                ? 'linear-gradient(160deg, oklch(from var(--gold) calc(l - 0.45) calc(c - 0.03) h / 0.30) 0%, var(--bg-2) 75%)'
                : 'var(--bg-2)',
              border: active
                ? '1px solid oklch(from var(--gold) l c h / 0.55)'
                : '1px solid var(--line)',
              boxShadow: active
                ? '0 0 24px oklch(from var(--gold) l c h / 0.14)'
                : 'none',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
          >
            <span
              className="display"
              style={{
                fontSize: 16,
                fontStyle: active ? 'italic' : 'normal',
                color: 'var(--ink)',
                lineHeight: 1.2,
              }}
            >
              {opt.label}
            </span>
            {opt.hint && (
              <span
                style={{
                  fontFamily: 'var(--body)',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                }}
              >
                {opt.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Multi-select chips with a max cap (triggers).
export function ChipMultiSelect<T extends string>({
  options,
  value,
  onChange,
  max = MAX_TRIGGERS,
}: {
  options: Option<T>[]
  value: T[]
  onChange: (v: T[]) => void
  max?: number
}) {
  const toggle = (code: T) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code))
    } else if (value.length < max) {
      onChange([...value, code])
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 9,
        }}
      >
        {options.map((opt) => {
          const active = value.includes(opt.code)
          const atCap = !active && value.length >= max
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => toggle(opt.code)}
              disabled={atCap}
              aria-pressed={active}
              className="tap"
              style={{
                padding: '9px 15px',
                borderRadius: 'var(--r-pill)',
                background: active
                  ? 'oklch(from var(--gold) l c h / 0.12)'
                  : 'transparent',
                border: active
                  ? '1px solid oklch(from var(--gold) l c h / 0.55)'
                  : '1px solid var(--line-strong)',
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                fontFamily: 'var(--display)',
                fontStyle: active ? 'italic' : 'normal',
                fontSize: 13.5,
                cursor: atCap ? 'not-allowed' : 'pointer',
                opacity: atCap ? 0.4 : 1,
                transition: 'all 0.18s ease',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: 'var(--body)',
          fontSize: 11.5,
          color: 'var(--ink-3)',
        }}
      >
        Pick up to {max} · {value.length} chosen
      </div>
    </div>
  )
}

// 1–5 comfort scale — five tappable steps with gentle anchor labels.
export function ComfortScale({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (v: number) => void
}) {
  const steps = [1, 2, 3, 4, 5]
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {steps.map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={active}
              aria-label={`${n} — ${COMFORT_ANCHORS[n]}`}
              className="tap"
              style={{
                flex: 1,
                height: 56,
                borderRadius: 'var(--r-md)',
                background: active
                  ? 'linear-gradient(180deg, oklch(from var(--gold) calc(l - 0.05) c h) 0%, var(--gold) 100%)'
                  : 'var(--bg-2)',
                border: active
                  ? '1px solid oklch(from var(--gold) l c h / 0.6)'
                  : '1px solid var(--line)',
                color: active ? 'oklch(20% 0.02 250)' : 'var(--ink-2)',
                fontFamily: 'var(--display)',
                fontSize: 20,
                fontWeight: 400,
                boxShadow: active
                  ? '0 0 20px oklch(from var(--gold) l c h / 0.3)'
                  : 'none',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
        }}
      >
        <span className="label" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
          {COMFORT_ANCHORS[1]}
        </span>
        <span className="label" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
          {COMFORT_ANCHORS[5]}
        </span>
      </div>
      {value != null && COMFORT_ANCHORS[value] && (
        <div
          key={value}
          className="fade-up"
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--gold-2)',
          }}
        >
          {COMFORT_ANCHORS[value]}
        </div>
      )}
    </div>
  )
}

// A quiet question heading used above each control.
export function QuestionHeading({
  children,
  sub,
}: {
  children: ReactNode
  sub?: ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2
        className="display"
        style={{
          fontSize: 24,
          margin: 0,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
        }}
      >
        {children}
      </h2>
      {sub && (
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: 13.5,
            color: 'var(--ink-2)',
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
