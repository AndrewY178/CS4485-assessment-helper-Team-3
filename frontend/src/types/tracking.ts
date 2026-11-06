export type TrackingStatus =
  | 'waiting-on-observer'
  | 'scheduled'
  | 'report-submitted'
  | 'needs-attention'

export interface TrackingRequestCounts {
  approved: number
  pending: number
  accepted: number
  declined: number
  confirmed: number
  notSelected: number
  expired: number
}

export interface TrackingObservation {
  observeeId: number
  observeeName: string
  courseId: number | null
  courseCode: string | null
  courseName: string | null
  meetingId: number | null
  meetingDate: string | null
  observerId: number | null
  observerName: string | null
  requestCounts: TrackingRequestCounts
  reportExists: boolean
  status: TrackingStatus
}

export interface TrackingResponse {
  signupSemester: string
  observations: TrackingObservation[]
}
