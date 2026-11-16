import { get, put } from './client'
import type { CycleDeadlineResponse, SaveCycleDeadlineRequest } from '../types/api'

export function getCycleDeadline(signupSemester: string, signal?: AbortSignal) {
  return get<CycleDeadlineResponse>(
    `/api/cycles/deadline?signup_semester=${encodeURIComponent(signupSemester)}`,
    { signal },
  )
}

export function saveCycleDeadline(body: SaveCycleDeadlineRequest, token: string) {
  return put<CycleDeadlineResponse>('/api/cycles/deadline', { body, token })
}
