import { put } from './client'

export interface ApproveObserversResponse {
  observee_id: number
  signup_semester: string
  meeting_id: number
  approved: number[]
  removed: number
}

// PUT /api/observers/approval: the AC approves 1-5 of the generated candidates.
// The candidates that were not approved are removed on the server.
export function approveObserverList(
  observeeId: string,
  signupSemester: string,
  observerIds: string[],
  token: string,
) {
  const params = new URLSearchParams({
    observee_id: observeeId,
    signup_semester: signupSemester,
  })

  return put<ApproveObserversResponse>(
    `/api/observers/approval?${params.toString()}`,
    { body: { observer_ids: observerIds }, token },
  )
}

export interface ReopenObserversResponse {
  observee_id: number
  signup_semester: string
  meeting_id: number
  previously_approved: number[]
}

// PUT /api/observers/reopen: takes an approved list back to "generated" (only before
// requests are sent). The unapproved candidates were deleted when the list was approved,
// so the caller regenerates the list afterwards to get every candidate back.
export function reopenObserverList(
  observeeId: string,
  signupSemester: string,
  token: string,
) {
  const params = new URLSearchParams({
    observee_id: observeeId,
    signup_semester: signupSemester,
  })

  return put<ReopenObserversResponse>(
    `/api/observers/reopen?${params.toString()}`,
    { token },
  )
}
