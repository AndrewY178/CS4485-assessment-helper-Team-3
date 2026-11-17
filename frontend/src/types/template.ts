export type TemplateStatus = 'current' | 'draft'
export type QuestionType = 'Rating 1–5' | 'Yes/No' | 'Short Answer' | 'Long Answer'

export interface TemplateCriterion {
  id: string
  name: string
  description: string
  type: QuestionType
  weight: number | null
  required: boolean
  position: number
}

export interface ObservationTemplate {
  id: string
  version: number | null
  status: TemplateStatus
  criteria: TemplateCriterion[]
  effectiveSemester: string | null
  isEditable?: boolean
  isInheritedDraft?: boolean
  signupDeadline?: string | null
}

export interface TemplateSemesterSummary {
  semester: string
  version: number | null
  status: 'draft' | 'published' | 'retired'
  isEditable: boolean
}
