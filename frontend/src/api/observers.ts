import { get, post } from './client'
import type { GenerateObserverListsResponse,ObserverCandidateResponse } from '../types/api'

export function generateObserverLists(signupSemester: string) {
  const params = new URLSearchParams({
    signup_semester: signupSemester,
  })

  return post<GenerateObserverListsResponse>(
    `/api/observers/generate?${params.toString()}`,
  )
}

export function getObserverList(
  observeeId: string,
  signupSemester: string,
) {
  const params = new URLSearchParams({
    observee_id: observeeId,
    signup_semester: signupSemester,
  })

  return get<ObserverCandidateResponse[]>(`/api/observers?${params.toString()}`)
}