import { get } from './client'
import type { CycleDeadlineResponse } from '../types/api'

export function getCycleDeadline(signupSemester: string, signal?: AbortSignal) {
  return get<CycleDeadlineResponse>(
    `/api/cycles/deadline?signup_semester=${encodeURIComponent(signupSemester)}`,
    { signal },
  )
}
