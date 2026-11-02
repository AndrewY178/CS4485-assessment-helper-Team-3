import type { EvaluationCycleResponse } from '../types/api'

export interface MockCycleRecord {
  cycle: EvaluationCycleResponse
  hasActivity: boolean
}

// Prototype semester choices only. Deadlines intentionally start empty and are
// populated by the AC Member until GET /api/schedule/{semesterId} is available.
export const initialCycleRecords: MockCycleRecord[] = [
  {
    cycle: {
      id: 'cycle-fall-2026',
      semesterId: '2026-fall',
      semesterLabel: 'Fall 2026',
      timezone: 'America/Chicago',
      status: 'draft',
      signupDeadline: '',
      observationDeadline: '',
      feedbackDeadline: '',
      updatedAt: '',
    },
    hasActivity: false,
  },
  {
    cycle: {
      id: 'cycle-spring-2027',
      semesterId: '2027-spring',
      semesterLabel: 'Spring 2027',
      timezone: 'America/Chicago',
      status: 'draft',
      signupDeadline: '',
      observationDeadline: '',
      feedbackDeadline: '',
      updatedAt: '',
    },
    hasActivity: false,
  },
]
