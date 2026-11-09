import { get, put } from './client'

export interface SignupDatesResponse {
  signup_semester: string
  meeting_id: number | null
  dates: string[]
}

// GET /api/signup-dates: the dates the signed-in faculty member offered for a semester
export function getSignupDates(
  semester: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ signup_semester: semester })
  return get<SignupDatesResponse>(`/api/signup-dates?${params.toString()}`, {
    signal,
    token,
  })
}

// PUT /api/signup-dates: replaces the offered dates (dates are YYYY-MM-DD)
export function saveSignupDates(
  semester: string,
  dates: string[],
  token: string,
) {
  return put<SignupDatesResponse>('/api/signup-dates', {
    body: { signup_semester: semester, dates },
    token,
  })
}
