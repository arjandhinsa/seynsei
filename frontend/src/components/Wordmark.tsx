// Brand lockup: the Seynsei mark beside the wordmark in the display serif.
// The mark inherits the brand accent so it always matches the UI palette.

export function SeynseiMark({
  size = 24,
  color = 'var(--gold)',
}: {
  size?: number
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M50 15 A28 28 0 1 0 60 45"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="36" cy="36" r="7.5" fill={color} />
    </svg>
  )
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.4),
      }}
    >
      <SeynseiMark size={Math.round(size * 1.1)} />
      <span
        className="display"
        style={{ fontSize: size, lineHeight: 1, letterSpacing: '-0.01em' }}
      >
        Seynsei
      </span>
    </span>
  )
}
