import type { ObserveeResponse } from '../types/api'
import { getObservees } from './observees'

export type SignUpStatus = 'Due' | 'Overdue'

export interface SignUpRequest {
  name: string
  email: string
  level: string
  course: string
  time: string
  status: SignUpStatus
  semester: string
}

function toSignUpRequest(observee: ObserveeResponse): SignUpRequest {
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
    name: observee.name,
    email: observee.email,
    level: observee.prof_rank,
    course: course || 'Not selected',
    time: time || 'Not selected',
    // The API currently returns signed-up observees without a due/overdue status.
    status: 'Due',
    semester: observee.signup_sem,
  }
}

export async function getSignUpRequests() {
  const observees = await getObservees()
  return observees.map(toSignUpRequest)
}
