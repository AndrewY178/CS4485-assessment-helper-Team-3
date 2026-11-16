import { get, put } from './client'
import type { ObservationTemplate, TemplateCriterion, TemplateSemesterSummary } from '../types/template'

export interface TemplatesResponse {
  semesters: TemplateSemesterSummary[]
}

export interface TemplateResponse {
  template: ObservationTemplate
  semesters: TemplateSemesterSummary[]
}

export function getTemplates(token: string, signal?: AbortSignal) {
  return get<TemplatesResponse>('/api/templates', { token, signal })
}

export function getTemplate(semester: string, token: string, signal?: AbortSignal) {
  return get<TemplateResponse>(`/api/templates/${encodeURIComponent(semester)}`, { token, signal })
}

export function saveTemplate(semester: string, criteria: TemplateCriterion[], token: string) {
  return put<{ template: ObservationTemplate }>(`/api/templates/${encodeURIComponent(semester)}`, {
    body: { criteria: criteria.map(({ name, description, type, weight, required }) => ({ name, description, type, weight, required })) },
    token,
  })
}
