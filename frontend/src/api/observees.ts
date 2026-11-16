import type {
  NoObserverObservee,
  ObserveeResponse,
  UncompletedObservee,
} from '../types/api'
import { get } from './client'


export function getObservees(signupSemester?: string) {
  const params = new URLSearchParams()
  if (signupSemester) {
    params.set('signup_semester', signupSemester)
  }

  const query = params.toString()
  return get<ObserveeResponse[]>(`/api/observees${query ? `?${query}` : ''}`)
}

export function getNoObserverObservees(
  signupSemester: string,
  token: string,
  signal?: AbortSignal,
) {
  return get<NoObserverObservee[]>(
    `/api/observees/no-observers?signup_semester=${encodeURIComponent(signupSemester)}`,
    { token, signal },
  )
}

export function getUncompletedObservees(
  signupSemester: string,
  token: string,
  signal?: AbortSignal,
) {
  return get<UncompletedObservee[]>(
    `/api/observees/uncompleted?signup_semester=${encodeURIComponent(signupSemester)}`,
    { token, signal },
  )
}