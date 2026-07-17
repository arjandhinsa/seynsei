import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface SudsSliderProps {
  /** null = user hasn't rated yet. The slider renders a ghosted, centred
   *  thumb and no fill; the first touch/drag sets a real value. Forcing
   *  the user to touch is deliberate: a pre-set default (previously 5)
   *  made "didn't engage" indistinguishable from "genuinely rated 5",
   *  which poisons the SUDS data the progression rules depend on. */
  value: number | null
  onChange: (value: number) => void
  min?: number
  max?: number
}

const ANCHORS = [
  { v: 1, label: 'calm' },
  { v: 5, label: 'moderate' },
  { v: 10, label: 'intense' },
]

export function SudsSlider({
  value,
  onChange,
  min = 1,
  max = 10,
}: SudsSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const range = max - min
  const isSet = value !== null
  // Unset: park the ghost thumb at the midpoint so there's no directional bias.
  const shown = isSet ? value : (min + max) / 2
  const fillPct = ((clamp(shown, min, max) - min) / range) * 100

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1)
      const next = Math.round(pct * range) + min
      if (next !== value) onChange(next)
    },
    [onChange, range, min, value],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    updateFromClientX(e.clientX)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    updateFromClientX(e.clientX)
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDragging(false)
  }

  return (
    <div style={{ width: '100%', userSelect: 'none' }}>
      {/* value bubble — tracks thumb horizontally */}
      <div style={{ position: 'relative', height: 56, marginBottom: 8 }}>
        <div
          className="display tnum"
          style={{
            position: 'absolute',
            left: `${fillPct}%`,
            transform: 'translateX(-50%)',
            bottom: 0,
            fontSize: 36,
            lineHeight: 1,
            color: 'var(--ink)',
            transition: dragging ? 'none' : 'left 0.15s ease',
            pointerEvents: 'none',
          }}
        >
          {isSet ? value : '—'}
        </div>
      </div>

      {/* track */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={isSet ? value : undefined}
        aria-valuetext={isSet ? String(value) : 'not yet rated'}
        style={{
          position: 'relative',
          height: 44,
          touchAction: 'none',
          cursor: 'pointer',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            height: 6,
            background: 'var(--bg-3)',
            borderRadius: 'var(--r-pill)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${isSet ? fillPct : 0}%`,
              height: '100%',
              background:
                'linear-gradient(90deg, oklch(from var(--teal) calc(l - 0.05) calc(c + 0.02) h) 0%, var(--gold) 100%)',
              boxShadow: '0 0 12px oklch(from var(--gold) l c h / 0.30)',
              transition: dragging ? 'none' : 'width 0.15s ease',
            }}
          />
        </div>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: `${fillPct}%`,
            transform: `translate(-50%, -50%) scale(${dragging ? 1.08 : 1})`,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 30%, oklch(from var(--gold) calc(l + 0.05) c h) 0%, oklch(from var(--gold) calc(l - 0.18) c h) 100%)',
            boxShadow: isSet
              ? '0 0 0 1px oklch(from var(--gold) l c h / 0.6), 0 0 18px oklch(from var(--gold) l c h / 0.45)'
              : '0 0 0 1px oklch(from var(--gold) l c h / 0.25)',
            opacity: isSet ? 1 : 0.35,
            transition: dragging ? 'transform 0.05s ease' : 'all 0.15s ease',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* anchor labels — calm / moderate / intense */}
      <div
        style={{
          position: 'relative',
          marginTop: 8,
          height: 14,
        }}
      >
        {ANCHORS.map((a) => {
          const left = ((a.v - min) / range) * 100
          const transform =
            a.v === min
              ? 'translateX(0)'
              : a.v === max
                ? 'translateX(-100%)'
                : 'translateX(-50%)'
          return (
            <span
              key={a.v}
              className="label"
              style={{
                position: 'absolute',
                left: `${left}%`,
                transform,
                fontSize: 9.5,
                color: 'var(--ink-3)',
              }}
            >
              {a.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
