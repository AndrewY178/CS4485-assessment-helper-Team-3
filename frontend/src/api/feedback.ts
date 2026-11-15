import type {
  FeedbackResponse,
  SaveFeedbackRequest,
} from '../types/feedback'
import { get, put } from './client'

export function getFeedback(
  semester: string,
  professorId: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    semester,
    observee_id: professorId,
  })

  return get<FeedbackResponse>(`/api/feedback?${params.toString()}`, {
    signal,
    token,
  })
}

export function saveFeedback(body: SaveFeedbackRequest, token: string) {
  return put<FeedbackResponse>('/api/feedback', { body, token })
}
