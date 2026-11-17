import type {
  FeedbackBreakdownResponse,
  FeedbackResponse,
  FeedbackStatusResponse,
  SaveFeedbackRequest,
} from '../types/feedback'
import { get, put } from './client'

export function saveFeedback(
  body: SaveFeedbackRequest,
  token: string,
) {
  return put<FeedbackResponse>('/api/feedback', { body, token })
}

export function getFeedbackStatus(
  semester: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ semester })

  return get<FeedbackStatusResponse>(
    `/api/feedback/status?${params.toString()}`,
    { signal, token },
  )
}

export function getFeedback(
  semester: string,
  professorId: string | number,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    semester,
    observee_id: String(professorId),
  })

  return get<FeedbackResponse>(
    `/api/feedback?${params.toString()}`,
    { signal, token },
  )
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