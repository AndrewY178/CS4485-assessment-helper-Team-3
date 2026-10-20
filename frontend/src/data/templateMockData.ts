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
      id: 'criterion-course-organization',
      name: 'Course Organization',
      description:
        'Evaluates how clearly the course materials, objectives, and lesson structure are organized.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 1,
    },
    {
      id: 'criterion-instructional-clarity',
      name: 'Instructional Clarity',
      description:
        'Evaluates how effectively the instructor explains concepts and communicates information.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 2,
    },
    {
      id: 'criterion-student-engagement',
      name: 'Student Engagement',
      description:
        'Evaluates how the instructor encourages participation and interaction.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 3,
    },
    {
      id: 'criterion-assessment-feedback',
      name: 'Assessment and Feedback',
      description:
        'Evaluates how the instructor assesses student understanding and provides feedback.',
      type: 'Rating 1–5',
      weight: 1,
      required: true,
      position: 4,
    },
  ],
  ratingScale: observationRatingScale,
  effectiveSemester: null,
}
