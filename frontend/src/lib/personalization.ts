import type { FocusArea, MainGoal, TriggerCode } from '../api/types'

// Shared, human-facing labels + option lists for the personalization answers.
// Used by the Welcome flow, Register payload, and the Profile "Your path" editor.

export const FOCUS_OPTIONS: { code: FocusArea; label: string; hint: string }[] = [
  { code: 'social', label: 'Social confidence', hint: 'Everyday connection' },
  { code: 'dating', label: 'Dating confidence', hint: 'Flirting & romance' },
  { code: 'both', label: 'Both', hint: 'A little of each' },
]

export const TRIGGER_OPTIONS: { code: TriggerCode; label: string }[] = [
  { code: 'strangers', label: 'Talking to strangers' },
  { code: 'groups', label: 'Group settings' },
  { code: 'authority', label: 'Authority figures' },
  { code: 'phone_calls', label: 'Phone calls' },
  { code: 'dating', label: 'Dating & flirting' },
  { code: 'being_watched', label: 'Being watched' },
  { code: 'speaking_up', label: 'Speaking up' },
]

export const GOAL_OPTIONS: { code: MainGoal; label: string; hint: string }[] = [
  { code: 'make_friends', label: 'Make friends', hint: 'Build real connection' },
  { code: 'confidence', label: 'Feel more confident', hint: 'In my own skin' },
  { code: 'dating', label: 'Date with ease', hint: 'Meet people, flirt freely' },
  { code: 'speak_up', label: 'Speak up more', hint: 'Be heard in the room' },
  { code: 'less_avoidance', label: 'Avoid less', hint: 'Stop sidestepping life' },
]

// Gentle anchor labels for the 1–5 comfort scale.
export const COMFORT_ANCHORS: Record<number, string> = {
  1: 'Very tense',
  2: 'Uneasy',
  3: 'Somewhere in between',
  4: 'Mostly at ease',
  5: 'Quite comfortable',
}

export const MAX_TRIGGERS = 3

export interface WelcomeAnswers {
  focus_area?: FocusArea
  top_triggers?: TriggerCode[]
  comfort_level?: number
  main_goal?: MainGoal
}

export const WELCOME_KEY = 'seynsei.welcome'
export const WELCOMED_KEY = 'seynsei.welcomed'

export function readWelcome(): WelcomeAnswers | null {
  try {
    const raw = localStorage.getItem(WELCOME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WelcomeAnswers
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function writeWelcome(answers: WelcomeAnswers): void {
  try {
    localStorage.setItem(WELCOME_KEY, JSON.stringify(answers))
  } catch {
    // storage may be unavailable (private mode) — non-fatal
  }
}

export function clearWelcome(): void {
  try {
    localStorage.removeItem(WELCOME_KEY)
  } catch {
    // non-fatal
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, 'true')
  } catch {
    // non-fatal
  }
}

export function hasWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === 'true'
  } catch {
    return false
  }
}

// True when at least one answer carries signal — used to decide whether to
// send a register/patch payload at all.
export function hasAnyAnswer(a: WelcomeAnswers | null): boolean {
  if (!a) return false
  return (
    a.focus_area != null ||
    (a.top_triggers != null && a.top_triggers.length > 0) ||
    a.comfort_level != null ||
    a.main_goal != null
  )
}
