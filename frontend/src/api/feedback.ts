import type {
  FeedbackBreakdownResponse,
  FeedbackResponse,
  SaveFeedbackRequest,
} from '../types/api'
import { get, put } from './client'

export function saveFeedback(body: SaveFeedbackRequest, token: string) {
  return put<FeedbackResponse>('/api/feedback', { body, token })
}

export function getFeedback(
  semester: string,
  observeeId: number,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    semester,
    observee_id: String(observeeId),
  })
  return get<FeedbackResponse>(`/api/feedback?${params.toString()}`, {
    signal,
    token,
  })
}

export function getFeedbackBreakdown(
  semester: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ semester })
  return get<FeedbackBreakdownResponse>(
    `/api/feedback/breakdown?${params.toString()}`,
    { signal, token },
  )
}
