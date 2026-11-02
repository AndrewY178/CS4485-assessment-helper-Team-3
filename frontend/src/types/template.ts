export type TemplateStatus = 'current' | 'draft'
export type QuestionType = 'Rating 1–5' | 'Yes/No' | 'Short Answer' | 'Long Answer'

export interface RatingOption {
  value: number
  label: string
}

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
  version: number
  status: TemplateStatus
  criteria: TemplateCriterion[]
  ratingScale: RatingOption[]
  effectiveSemester: string | null
}
