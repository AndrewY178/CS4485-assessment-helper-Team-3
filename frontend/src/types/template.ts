export type TemplateStatus = 'current' | 'draft'

export interface RatingOption {
  value: number
  label: string
}

export interface TemplateCriterion {
  id: string
  name: string
  description: string
  type: 'Rating 1–5'
  weight: number
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

