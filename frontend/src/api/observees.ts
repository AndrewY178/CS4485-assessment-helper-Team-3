import type { ObserveeResponse } from '../types/api'
import { get } from './client'


export function getObservees(signupSemester?: string) {
  const params = new URLSearchParams()
  if (signupSemester) {
    params.set('signup_semester', signupSemester)
  }

  const query = params.toString()
  return get<ObserveeResponse[]>(`/api/observees${query ? `?${query}` : ''}`)
}