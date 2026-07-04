import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, clearTokens, getAccessToken, setTokens } from '../client'
import type {
  FocusArea,
  LoginRequest,
  MainGoal,
  RegisterRequest,
  TokenResponse,
  TriggerCode,
  UserResponse,
} from '../types'

const ME_QUERY_KEY = ['me'] as const

export function useCurrentUser() {
  return useQuery<UserResponse>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<UserResponse>('/auth/me'),
    enabled: getAccessToken() !== null,
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation<TokenResponse, Error, LoginRequest>({
    mutationFn: (body) =>
      apiFetch<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (tokens) => {
      setTokens(tokens)
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation<TokenResponse, Error, RegisterRequest>({
    mutationFn: (body) =>
      apiFetch<TokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (tokens) => {
      setTokens(tokens)
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
    },
  })
}

export function useLogout(): () => void {
  const qc = useQueryClient()
  return () => {
    clearTokens()
    qc.clear()
  }
}

export interface UpdateMeRequest {
  display_name?: string | null
  equipped_avatar_id?: string | null
  focus_area?: FocusArea | null
  top_triggers?: TriggerCode[] | null
  comfort_level?: number | null
  main_goal?: MainGoal | null
  onboarding_completed?: boolean
}

// DELETE /api/auth/me — hard-deletes the current user. Backend cascades
// completions, conversations/messages, achievements, recommendation logs.
// Caller is responsible for clearing tokens + navigating after success.
export function useDeleteMe() {
  return useMutation<void, Error, void>({
    mutationFn: () => apiFetch<void>('/auth/me', { method: 'DELETE' }),
  })
}

// PATCH /api/auth/me — partial update. Pass only the fields you want to
// change. Pass `null` to clear a nullable field. Other fields are untouched.
// On success, invalidates the cached /me so screens re-render with new data.
export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation<UserResponse, Error, UpdateMeRequest>({
    mutationFn: (body) =>
      apiFetch<UserResponse>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (user) => {
      // Replace the cached value directly so the next render is instant
      // (no flash of old data while the invalidated query refetches).
      qc.setQueryData(ME_QUERY_KEY, user)
    },
  })
}
