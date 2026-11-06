import type { TrackingResponse } from '../types/tracking'
import { get } from './client'

export function getObservationTracking(
  signupSemester: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ signup_semester: signupSemester })
  return get<TrackingResponse>(`/api/tracking?${params.toString()}`, {
    signal,
    token,
  })
}
