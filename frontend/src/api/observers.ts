import { get, post } from './client'
import type {
  AcceptedObserverResponse,
  GenerateObserverListsResponse,
  ObserverCandidateResponse,
} from '../types/api'

export function generateObserverLists(signupSemester: string) {
  const params = new URLSearchParams({
    signup_semester: signupSemester,
  })

  return post<GenerateObserverListsResponse>(
    `/api/observers/generate?${params.toString()}`,
  )
}

// generates a single observer list (used when AC member wants to regenerate the list for a single person)
export function regenerateObserverList(
  observeeId: string,
  signupSemester: string,
) {
  const params = new URLSearchParams({
    observee_id: observeeId,
    signup_semester: signupSemester,
  })

  return post<ObserverCandidateResponse[]>(
    `/api/observers?${params.toString()}`,
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

export function getAcceptedObservers(
  observeeId: string,
  signupSemester: string,
) {
  const params = new URLSearchParams({
    observee_id: observeeId,
    signup_semester: signupSemester,
  })

  return get<AcceptedObserverResponse[]>(
    `/api/observers/accepted?${params.toString()}`,
  )
}