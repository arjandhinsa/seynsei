export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// Personalization codes shared by register, /auth/me, and the welcome flow.
export type FocusArea = 'social' | 'dating' | 'both'
export type TriggerCode =
  | 'strangers'
  | 'groups'
  | 'authority'
  | 'phone_calls'
  | 'dating'
  | 'being_watched'
  | 'speaking_up'
export type MainGoal =
  | 'make_friends'
  | 'confidence'
  | 'dating'
  | 'speak_up'
  | 'less_avoidance'

export interface Personalization {
  focus_area?: FocusArea | null
  top_triggers?: TriggerCode[] | null
  comfort_level?: number | null
  main_goal?: MainGoal | null
}

export interface RegisterRequest {
  email: string
  password: string
  display_name?: string | null
  focus_area?: FocusArea | null
  top_triggers?: TriggerCode[] | null
  comfort_level?: number | null
  main_goal?: MainGoal | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RefreshRequest {
  refresh_token: string
}

export interface UserResponse {
  id: string
  email: string
  display_name: string | null
  equipped_avatar_id: string | null
  focus_area: FocusArea | null
  top_triggers: TriggerCode[] | null
  comfort_level: number | null
  main_goal: MainGoal | null
  onboarding_completed: boolean
}

export type Domain = 'social' | 'dating'

export interface DomainSummary {
  domain: Domain
  label: string
  total_completions: number
  unique_challenges_completed: number
  total_challenges: number
  avg_suds_reduction: number | null
}

export interface RecentCompletion {
  completion_id: string
  challenge_id: string
  challenge_name: string
  domain: Domain
  tier: number
  completed_at: string
  xp_earned: number
  anxiety_before: number | null
  anxiety_after: number | null
  streak_day: number
}

export interface UnlockedAchievement {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  xp_bonus: number
  unlocked_at: string
}

export interface DashboardOverview {
  user_id: string
  display_name: string | null

  total_xp: number
  current_level: number
  xp_in_level: number
  xp_needed_for_level: number
  xp_to_next_level: number

  current_streak: number
  longest_streak: number
  is_streak_active: boolean
  last_completion_date: string | null

  total_completions: number
  domain_breakdown: DomainSummary[]
  recent_completions: RecentCompletion[]

  unlocked: UnlockedAchievement[]
  unlocked_count: number
  total_achievements: number
}

export interface Recommendation {
  challenge_id: string
  name: string
  domain: Domain
  tier: number
  reason: string
}

export interface Challenge {
  id: string
  domain: Domain
  tier: number
  name: string
  description: string
  tip: string | null
  rationale: string | null
  xp_value: number
  safety_behaviour_targeted: string | null
  cognitive_distortion_challenged: string | null
}

export interface Completion {
  id: string
  challenge_id: string
  completed_at: string
  anxiety_before: number | null
  anxiety_after: number | null
  notes: string | null
  xp_earned: number
  streak_day: number
}

export interface AchievementInfo {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  xp_bonus: number
}

export interface CompletionResultResponse {
  completion: Completion
  xp_earned: number
  bonus_xp_from_achievements: number
  total_xp_after: number
  level_before: number
  level_after: number
  leveled_up: boolean
  streak_day: number
  streak_after: number
  is_new_personal_best_streak: boolean
  newly_unlocked: AchievementInfo[]
}

export interface CompletionRequest {
  anxiety_before: number | null
  anxiety_after: number | null
  notes: string | null
}

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  created_at: string
}

export interface ConversationDetailResponse {
  id: string
  challenge_id: string | null
  started_at: string
  messages: ChatMessage[]
}

export interface StartConversationRequest {
  challenge_id?: string | null
  completion_id?: string | null
  first_message?: string | null
}

export interface RecentConversationResponse {
  conversation_id: string | null
}

export interface AchievementCatalogEntry {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  // 'total_completions' | 'tier_reached' | 'streak_days' | 'xp_milestone' |
  // 'challenge_repeat_count' | 'domain_balance' — kept open since backend
  // treats it as a free string.
  condition_type: string
  condition_value: number
  xp_bonus: number
}
