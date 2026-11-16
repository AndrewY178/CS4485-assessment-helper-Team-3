import type { ObserveeResponse, UncompletedObservee } from '../types/api'
import { getObservees, getUncompletedObservees } from './observees'

export type SignUpStatus = 'Due' | 'Overdue'

export interface SignUpRequest {
  id: string
  name: string
  email: string
  level: string
  course: string
  time: string
  status: SignUpStatus
  semester: string
}

function signupStatus(
  observeeId: string,
  uncompleted: UncompletedObservee[],
): SignUpStatus {
  const row = uncompleted.find((item) => String(item.observee_id) === observeeId)
  if (row?.uncompleted && row.meeting_date) return 'Overdue'
  return 'Due'
}

function toSignUpRequest(
  observee: ObserveeResponse,
  uncompleted: UncompletedObservee[],
): SignUpRequest {
  const course = [
    observee.course_department,
    observee.course_number,
    observee.section_number,
  ]
    .filter(Boolean)
    .join(' ')

  const time = [
    observee.course_day,
    observee.course_start_time?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(' ')

  return {
    id: String(observee.id),
    name: observee.name,
    email: observee.email,
    level: observee.prof_rank || '',
    course: course || 'Not selected',
    time: time || 'Not selected',
    status: signupStatus(String(observee.id), uncompleted),
    semester: observee.signup_sem,
  }
}

export async function getSignUpRequests(token: string, signal?: AbortSignal) {
  const observees = await getObservees()
  const semester = observees[0]?.signup_sem
  const uncompleted = semester
    ? await getUncompletedObservees(semester, token, signal)
    : []
  return observees.map((observee) => toSignUpRequest(observee, uncompleted))
}
