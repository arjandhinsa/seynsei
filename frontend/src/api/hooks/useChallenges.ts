import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getAccessToken } from '../client'
import type {
  Challenge,
  Completion,
  CompletionRequest,
  CompletionResultResponse,
  Domain,
} from '../types'

interface ChallengeFilter {
  domain?: Domain
  tier?: number
}

function buildPath(opts?: ChallengeFilter): string {
  const params = new URLSearchParams()
  if (opts?.domain) params.set('domain', opts.domain)
  if (opts?.tier) params.set('tier', String(opts.tier))
  const qs = params.toString()
  return qs ? `/challenges/?${qs}` : '/challenges/'
}

export function useChallenges(opts?: ChallengeFilter) {
  // Catalog is public — GET /challenges works without auth (user-specific
  // fields are simply absent/defaulted for guests), so no `enabled` gate.
  return useQuery<Challenge[]>({
    queryKey: ['challenges', { domain: opts?.domain ?? null, tier: opts?.tier ?? null }],
    queryFn: () => apiFetch<Challenge[]>(buildPath(opts)),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCompletions() {
  return useQuery<Completion[]>({
    queryKey: ['completions'],
    queryFn: () => apiFetch<Completion[]>('/challenges/completions'),
    enabled: getAccessToken() !== null,
    staleTime: 1000 * 30,
  })
}

interface UseChallengeByIdResult {
  data: Challenge | undefined
  isLoading: boolean
  isError: boolean
  notFound: boolean
}

export function useCreateCompletion(challengeId: string) {
  const qc = useQueryClient()
  return useMutation<CompletionResultResponse, Error, CompletionRequest>({
    mutationFn: (body) =>
      apiFetch<CompletionResultResponse>(
        `/challenges/${challengeId}/complete`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress', 'overview'] })
      qc.invalidateQueries({ queryKey: ['progress', 'recommend'] })
      qc.invalidateQueries({ queryKey: ['completions'] })
    },
  })
}

export function useChallengeById(id: string | undefined): UseChallengeByIdResult {
  // Reuses the unfiltered list query — works fine for our 18-row catalog
  // and avoids needing a dedicated detail endpoint.
  const list = useChallenges()
  if (!id) return { data: undefined, isLoading: false, isError: false, notFound: true }
  if (list.isLoading) return { data: undefined, isLoading: true, isError: false, notFound: false }
  if (list.isError) return { data: undefined, isLoading: false, isError: true, notFound: false }
  const match = list.data?.find((c) => c.id === id)
  return {
    data: match,
    isLoading: false,
    isError: false,
    notFound: !match,
  }
}
