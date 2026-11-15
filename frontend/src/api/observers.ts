import { get, post } from './client'
import type {
  AcceptedObserverResponse,
  GenerateObserverListsResponse,
  ConfirmObserverResponse,
  ObserverCandidateResponse,
  ObserverRequestResponse,
  SendObserverRequestsResponse,
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

export function sendObserverRequests(
  observeeId: string,
  signupSemester: string,
  observerIds: string[],
) {
  return post<SendObserverRequestsResponse>('/api/observers/request', {
    body: {
      observee_id: Number(observeeId),
      signup_semester: signupSemester,
      observer_ids: observerIds.map(Number),
    },
  })
}

export function confirmObserver(
  signupSemester: string,
  observerId: string,
  token: string,
) {
  return post<ConfirmObserverResponse>('/api/observers/confirm', {
    body: {
      signup_semester: signupSemester,
      observer_id: Number(observerId),
    },
    token,
  })
}

export function getObserverRequests(token: string, signal?: AbortSignal) {
  return get<ObserverRequestResponse[]>('/api/observer-requests', { token, signal })
}

export function acceptObserverRequest(
  meetingId: number,
  selectedDate: string,
  token: string,
) {
  return post<{ meeting_id: number; status: 'accepted'; selected_date: string }>(
    `/api/observer-requests/${meetingId}/accept`,
    { body: { selected_date: selectedDate }, token },
  )
}

export function declineObserverRequest(meetingId: number, token: string) {
  return post<{ meeting_id: number; status: 'declined' }>(
    `/api/observer-requests/${meetingId}/decline`,
    { token },
  )
}