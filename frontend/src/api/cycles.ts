import { get, put } from './client'
import type { SaveEvaluationCycleRequest } from '../types/api'

interface ScheduleRow {
  semester: string
  cycle_status: string
  signup_deadline: string
  observation_deadline: string
  feedback_deadline: string
  updated_at: string
}

export function getEvaluationCycles(token: string) {
  return get<ScheduleRow[]>('/api/schedule', { token })
}

export function saveEvaluationCycle(
  semester: string,
  deadlines: SaveEvaluationCycleRequest,
  token: string,
) {
  return put<{ message: string }>(`/api/schedule/${encodeURIComponent(semester)}`, {
    body: {
      signupDeadline: new Date(deadlines.signupDeadline).toISOString(),
      observationDeadline: new Date(deadlines.observationDeadline).toISOString(),
      feedbackDeadline: new Date(deadlines.feedbackDeadline).toISOString(),
    },
    token,
  })
}

export type { ScheduleRow }
