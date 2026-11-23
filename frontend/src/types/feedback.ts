export type FeedbackSemesterRole = 'observee' | 'observer' | 'both'

export type FeedbackProcessRating = 'yes' | 'mostly' | 'no'

export interface FeedbackSurveyContext {
  semester: string
  feedbackDeadline: string | null
}

// GET /api/feedback/status
export interface FeedbackStatusResponse {
  semester: string
  open: boolean
  message: string | null
  observationDeadline: string | null
  feedbackDeadline: string | null
}

export interface FeedbackResponse {
  semester: string
  observee_id: number
  semester_role: FeedbackSemesterRole
  process_OK: FeedbackProcessRating
  difficulties: string | null
  improvements: string | null
}

export interface SaveFeedbackRequest {
  semester: string
  semester_role: FeedbackSemesterRole
  process_OK: FeedbackProcessRating
  difficulties: string | null
  improvements: string | null
}

export interface FeedbackBreakdownResponse {
  semester: string
  counts: {
    yes: number
    mostly: number
    no: number
  }
}
