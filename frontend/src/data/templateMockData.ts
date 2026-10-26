import type { ObservationTemplate, RatingOption } from '../types/template'

// Prototype-only data. The finalized scale and criteria will be supplied by the API later.
export const observationRatingScale: RatingOption[] = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Below Expectations' },
  { value: 3, label: 'Meets Expectations' },
  { value: 4, label: 'Exceeds Expectations' },
  { value: 5, label: 'Excellent' },
]

export const currentObservationTemplate: ObservationTemplate = {
  id: 'observation-template-v2',
  version: 2,
  status: 'current',
  criteria: [
    {
      id: 'criterion-content-clarity',
      name: 'Content clarity',
      description: 'Evaluates how clearly course concepts and material are presented.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 1,
    },
    {
      id: 'criterion-student-engagement-interaction',
      name: 'Student engagement/interaction',
      description: 'Evaluates student participation and interaction during the class.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 2,
    },
    {
      id: 'criterion-openness-to-questions',
      name: 'Openness to answering questions/response to questions',
      description: 'Evaluates how effectively student questions are welcomed and answered.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 3,
    },
    {
      id: 'criterion-use-of-technology',
      name: 'Use of technology',
      description: 'Evaluates how technology supports instruction and student learning.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 4,
    },
  ],
  ratingScale: observationRatingScale,
  effectiveSemester: null,
}
