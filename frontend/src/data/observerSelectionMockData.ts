import type {
  ObserverCandidateResponse,
  ObserverSelectionResponse,
} from '../types/api'

export const observerSelectionContext = {
  currentSemester: {
    id: '2026-fall',
    label: 'Fall 2026',
  },
  // TODO(API): Replace with the current cycle returned by Flask/Cycle Setup.
  signupDeadlinePassed: true,
}

const candidate = (
  facultyId: string,
  name: string,
  department: string,
  relevantCourseLevel: string,
  currentObservationCount: number,
  scheduleCompatibility: string,
  matchingReasons: string[],
  eligibilityStatus: ObserverCandidateResponse['eligibilityStatus'] = 'eligible',
): ObserverCandidateResponse => ({
  facultyId,
  name,
  department,
  relevantCourseLevel,
  currentObservationCount,
  remainingCapacity: Math.max(0, 3 - currentObservationCount),
  scheduleCompatibility,
  eligibilityStatus,
  matchingReasons,
})

const candidates = {
  c101: candidate('faculty-101', 'Professor 101', 'Computer Science', 'Undergraduate', 1, 'No conflict with class meeting time', ['Matching course prefix', 'Appropriate course-level experience', 'No schedule conflict']),
  c102: candidate('faculty-102', 'Professor 102', 'Computer Science', 'Undergraduate', 0, 'No conflict with class meeting time', ['Matching department', 'Appropriate course-level experience', 'Available workload']),
  c103: candidate('faculty-103', 'Professor 103', 'Software Engineering', 'Undergraduate and Graduate', 2, 'No conflict with class meeting time', ['Related course prefix', 'Graduate teaching experience', 'No schedule conflict']),
  c104: candidate('faculty-104', 'Professor 104', 'Computer Science', 'Undergraduate', 1, 'No conflict with class meeting time', ['Matching department', 'Appropriate course-level experience', 'No schedule conflict']),
  c105: candidate('faculty-105', 'Professor 105', 'Information Technology', 'Undergraduate', 0, 'No conflict with class meeting time', ['Related teaching experience', 'No schedule conflict', 'Available workload']),
  c106: candidate('faculty-106', 'Professor 106', 'Computer Science', 'Undergraduate and Graduate', 3, 'Schedule changed after matching', ['Matching course prefix', 'Appropriate course-level experience'], 'unavailable'),
  c107: candidate('faculty-107', 'Professor 107', 'Computer Science', 'Graduate', 1, 'No conflict with class meeting time', ['Matching course prefix', 'Graduate teaching experience', 'No schedule conflict']),
  c108: candidate('faculty-108', 'Professor 108', 'Software Engineering', 'Undergraduate', 2, 'No conflict with class meeting time', ['Related course prefix', 'Appropriate course-level experience']),
  c109: candidate('faculty-109', 'Professor 109', 'Computer Science', 'Graduate', 0, 'No conflict with class meeting time', ['Matching department', 'Graduate teaching experience', 'Available workload']),
}

function eligibleIds(items: ObserverCandidateResponse[]) {
  return items.filter((item) => item.eligibilityStatus === 'eligible').map((item) => item.facultyId)
}

const pendingRecommendations = [candidates.c101, candidates.c102, candidates.c104, candidates.c105, candidates.c106]
const approvedRecommendations = [candidates.c103, candidates.c107, candidates.c109]
const sentRecommendations = [candidates.c102, candidates.c104, candidates.c105, candidates.c108]

export const initialObserverSelectionRows: ObserverSelectionResponse[] = [
  {
    observationId: 'observation-201',
    semesterId: observerSelectionContext.currentSemester.id,
    observee: { facultyId: 'faculty-201', name: 'Professor 201', department: 'Computer Science' },
    course: { code: 'CS 4345', section: '001', title: 'Database Systems', meetingDays: ['Mon', 'Wed'], startTime: '10:00 AM', endTime: '11:15 AM' },
    status: 'not-generated',
    recommendations: [],
    selectedCandidateIds: [],
  },
  {
    observationId: 'observation-202',
    semesterId: observerSelectionContext.currentSemester.id,
    observee: { facultyId: 'faculty-202', name: 'Professor 202', department: 'Software Engineering' },
    course: { code: 'SE 3354', section: '002', title: 'Software Engineering', meetingDays: ['Tue', 'Thu'], startTime: '1:00 PM', endTime: '2:15 PM' },
    status: 'pending-review',
    recommendations: pendingRecommendations,
    selectedCandidateIds: eligibleIds(pendingRecommendations),
    warning: 'One recommendation is no longer available and cannot be approved.',
  },
  {
    observationId: 'observation-203',
    semesterId: observerSelectionContext.currentSemester.id,
    observee: { facultyId: 'faculty-203', name: 'Professor 203', department: 'Computer Science' },
    course: { code: 'CS 6360', section: '001', title: 'Database Design', meetingDays: ['Mon', 'Wed'], startTime: '4:00 PM', endTime: '5:15 PM' },
    status: 'approved',
    recommendations: approvedRecommendations,
    selectedCandidateIds: eligibleIds(approvedRecommendations),
  },
  {
    observationId: 'observation-204',
    semesterId: observerSelectionContext.currentSemester.id,
    observee: { facultyId: 'faculty-204', name: 'Professor 204', department: 'Computer Science' },
    course: { code: 'CS 2336', section: '003', title: 'Computer Science II', meetingDays: ['Tue', 'Thu'], startTime: '11:30 AM', endTime: '12:45 PM' },
    status: 'invitations-sent',
    recommendations: sentRecommendations,
    selectedCandidateIds: eligibleIds(sentRecommendations),
  },
  {
    observationId: 'observation-205',
    semesterId: observerSelectionContext.currentSemester.id,
    observee: { facultyId: 'faculty-205', name: 'Professor 205', department: 'Computer Science' },
    course: { code: 'CS 6V81', section: '001', title: 'Graduate Research Seminar', meetingDays: ['Fri'], startTime: '3:00 PM', endTime: '5:45 PM' },
    status: 'no-eligible-observers',
    recommendations: [],
    selectedCandidateIds: [],
    warning: 'No eligible observers were found for this course and meeting time.',
  },
]

const generatedRecommendations: Record<string, ObserverCandidateResponse[][]> = {
  'observation-201': [
    [candidates.c101, candidates.c102, candidates.c103, candidates.c104, candidates.c105],
    [candidates.c101, candidates.c102, candidates.c104, candidates.c105],
  ],
  'observation-202': [
    [candidates.c101, candidates.c102, candidates.c103, candidates.c104],
  ],
  'observation-203': [
    [candidates.c101, candidates.c103, candidates.c107, candidates.c108],
  ],
  'observation-205': [
    [],
    [candidates.c103, candidates.c107],
  ],
}

export function getMockRecommendations(observationId: string, attempt: number) {
  const sets = generatedRecommendations[observationId] ?? []
  if (sets.length === 0) return []
  return sets[Math.min(attempt, sets.length - 1)].slice(0, 5)
}
