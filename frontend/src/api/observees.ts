import type { ObserveeResponse } from '../types/api'
import { get } from './client'


export function getObservees(signupSemester: string) {
  const params = new URLSearchParams({
    signup_semester: signupSemester,
  })

  return get<ObserveeResponse[]>(`/api/observees?${params.toString()}`)
}