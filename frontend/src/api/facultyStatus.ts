import { get } from './client'

export interface PastObservation {
  semester: string
  courseCode: string | null
  courseName: string | null
}

export interface FacultyStatusResponse {
  semester: string
  signupDeadline: string | null
  observationDeadline: string | null
  professorRank: string | null
  lastSemesterObserved: string | null
  pastObservations: PastObservation[]
}

export function getFacultyStatus(token: string, signal?: AbortSignal) {
  return get<FacultyStatusResponse>('/api/faculty/status', { signal, token })
}
