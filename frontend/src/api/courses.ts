import { get } from './client'
import type { FacultyCourse } from '../types/api'

export function getFacultyCourses(semester: string, token: string, signal?: AbortSignal) {
  return get<FacultyCourse[]>(
    `/api/faculty/courses?semester=${encodeURIComponent(semester)}`,
    { token, signal },
  )
}
