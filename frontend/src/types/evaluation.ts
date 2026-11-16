export type EvaluationQuestionType = 'rating' | 'yes_no' | 'short_answer' | 'long_answer'
export type EvaluationValue = number | string
export type EvaluationStatus = 'not_started' | 'upcoming' | 'canceled' | 'draft' | 'awaiting_observee' | 'complete'

export interface EvaluationQuestion {
  id: number
  key: string
  name: string
  description: string
  type: EvaluationQuestionType
  weight: number | null
  required: boolean
  position: number
}

export interface EvaluationRecord {
  id: number
  meetingId: number
  semester: string
  meetingDate: string
  course: { code: string; title: string }
  observer: { id: number; name: string }
  observee: { id: number; name: string }
  versionId: number | null
  status: Exclude<EvaluationStatus, 'not_started'>
  questions: EvaluationQuestion[]
  answers: Record<string, EvaluationValue>
  observerSignature: { name: string | null; signedAt: string | null }
  observeeSignature: { name: string | null; signedAt: string | null }
  observeeResponse: string
  updatedAt: string
}

export interface ObserverEvaluationItem {
  meetingId: number
  evaluationId: number | null
  semester: string
  meetingDate: string
  course: { code: string; title: string }
  observeeName: string
  status: EvaluationStatus
  canStart: boolean
  deadlinePassed: boolean
}
