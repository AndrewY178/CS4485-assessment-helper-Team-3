import type { FacultyScheduleResponse } from '../types/schedule'
import { get } from './client'

export function getFacultySchedule(
  semester: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ semester })
  return get<FacultyScheduleResponse>(
    `/api/faculty/schedule?${params.toString()}`,
    { signal, token },
  )
}
