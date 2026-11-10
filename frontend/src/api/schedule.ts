import type { FacultyScheduleResponse } from '../types/schedule'
import { get } from './client'

// Used by schedule and observer-request screens until they receive an active
// semester from their own API responses.
export const TEMPORARY_SCHEDULE_SEMESTER = 'Fall 2026'

export interface FacultyCourse {
  course_id: number
  department: string
  course_number: string
  section_number: string
  course_name: string
  course_day: string | null
  course_start_time: string | null
  course_end_time: string | null
  room_number: string | null
}

export interface FacultyCoursesResponse {
  semester: string
  courses: FacultyCourse[]
}

export function getFacultyCourses(semester: string, token: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ semester })
  return get<FacultyCoursesResponse>(`/api/faculty/courses?${params.toString()}`, {
    signal,
    token,
  })
}

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
