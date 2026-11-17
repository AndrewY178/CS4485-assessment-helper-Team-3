import type { EvaluationRecord, ObserverEvaluationItem } from '../types/evaluation'
import { get, post, put } from './client'

export function getObserverEvaluations(token: string, signal?: AbortSignal) {
  return get<{ observations: ObserverEvaluationItem[] }>('/api/evaluations/observer', { token, signal })
}

export function getObserveeEvaluations(token: string, signal?: AbortSignal) {
  return get<{ evaluations: EvaluationRecord[] }>('/api/evaluations/observee', { token, signal })
}

export function getEvaluation(evaluationId: number, token: string, signal?: AbortSignal) {
  return get<{ evaluation: EvaluationRecord }>(`/api/evaluations/${evaluationId}`, { token, signal })
}

export function startEvaluation(meetingId: number, token: string) {
  return post<{ evaluation: EvaluationRecord }>(`/api/meetings/${meetingId}/evaluation`, { token })
}

export function saveObserverAnswers(evaluationId: number, answers: Record<string, number | string>, token: string) {
  return put<{ evaluation: EvaluationRecord }>(`/api/evaluations/${evaluationId}`, {
    body: { answers },
    token,
  })
}

export function signAsObserver(evaluationId: number, typedName: string, answers: Record<string, number | string>, token: string) {
  return post<{ evaluation: EvaluationRecord }>(`/api/evaluations/${evaluationId}/observer-signature`, {
    body: { typedName, answers },
    token,
  })
}

export function saveObserveeResponse(evaluationId: number, response: string, token: string) {
  return put<{ evaluation: EvaluationRecord }>(`/api/evaluations/${evaluationId}/observee-response`, {
    body: { response },
    token,
  })
}

export function signAsObservee(evaluationId: number, typedName: string, response: string, token: string) {
  return post<{ evaluation: EvaluationRecord }>(`/api/evaluations/${evaluationId}/observee-signature`, {
    body: { typedName, response },
    token,
  })
}

export function cancelObservation(meetingId: number, token: string) {
  return post<{ meetingId: number; status: 'canceled' }>(`/api/meetings/${meetingId}/cancel`, { token })
}
