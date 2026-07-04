import { API_BASE_URL, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './config'
import type { TokenResponse } from './types'

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

// Convenience predicate for guest-aware screens + query gating.
export function isAuthed(): boolean {
  return getAccessToken() !== null
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(tokens: TokenResponse): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// Single in-flight refresh promise. If 5 requests 401 simultaneously, they all
// await this same promise instead of triggering 5 parallel /auth/refresh calls.
let refreshInFlight: Promise<string | null> | null = null

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    clearTokens()
    return null
  }

  const tokens = (await res.json()) as TokenResponse
  setTokens(tokens)
  return tokens.access_token
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

function buildHeaders(init: RequestInit | undefined, token: string | null): Headers {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || 'Request failed'
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') {
      detail = body.detail
    } else if (body.detail != null) {
      detail = JSON.stringify(body.detail)
    }
  } catch {
    // body wasn't JSON — fall back to statusText
  }
  return new ApiError(res.status, detail)
}

async function parseSuccess<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const token = getAccessToken()

  let res = await fetch(url, { ...init, headers: buildHeaders(init, token) })

  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await fetch(url, { ...init, headers: buildHeaders(init, newToken) })
    }
  }

  // 404 on /auth/me means the token signed fine but the user it points to no
  // longer exists (typical after a DB wipe in dev). Refresh wouldn't help — a
  // new token would carry the same dead user_id. Treat as session-invalid:
  // clear tokens so the route guard bounces to /auth/login instead of looping.
  if (res.status === 404 && path === '/auth/me') {
    clearTokens()
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  return parseSuccess<T>(res)
}
