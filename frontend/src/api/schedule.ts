import type { FacultyScheduleResponse } from '../types/schedule'
import { get } from './client'

// TODO(API): Replace this temporary semester with the active cycle returned by
// Flask once the active-cycle endpoint is available.
export const TEMPORARY_SCHEDULE_SEMESTER = 'Fall 2026'

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
