import { useEffect, useState } from 'react'
import { ApiError } from '../../../api/auth'
import { getPastObservations } from '../../../api/pastObservations'
import { useAuth } from '../../../context/AuthContext'
import type { PastObservation } from '../../../types/api'

const reportFields: Array<{
  field: keyof Pick<
    PastObservation,
    | 'content_clarity'
    | 'student_engagement'
    | 'openness_to_questions'
    | 'tech_use'
    | 'slide_readability'
    | 'lecture_pace'
  >
  label: string
}> = [
  { field: 'content_clarity', label: 'Content clarity' },
  { field: 'student_engagement', label: 'Student engagement' },
  { field: 'openness_to_questions', label: 'Openness to questions' },
  { field: 'tech_use', label: 'Tech use' },
  { field: 'slide_readability', label: 'Slide readability' },
  { field: 'lecture_pace', label: 'Lecture pace' },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function relationship(observation: PastObservation, userId: string | null) {
  const observed = userId !== null && String(observation.observeeId) === userId
  const observing = userId !== null && String(observation.observerId) === userId
  if (observed && !observing) {
    return { role: 'Observee', counterpart: observation.observerName || '—' }
  }
  if (observing && !observed) {
    return { role: 'Observer', counterpart: observation.observeeName }
  }
  return { role: 'Observee and observer', counterpart: observation.observeeName }
}

export default function MyObservationPage() {
  const { token, userId } = useAuth()
  const [observations, setObservations] = useState<PastObservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setError('Your session is unavailable. Please sign in again.')
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError('')
    getPastObservations(token, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setObservations(response.observations)
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setObservations([])
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : 'Unable to load past observations.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [loadAttempt, token])

  return (
    <section className="screen-page participant-page observation-page">
      <header className="participant-header">
        <div>
          <h1>My observations</h1>
          <p>Past observations where you were the observer or the observee.</p>
        </div>
      </header>

      {isLoading && <p role="status">Loading past observations...</p>}

      {!isLoading && error && (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button
            className="button button--outline"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && observations.length === 0 && (
        <p>No past observations yet.</p>
      )}

      {!isLoading && !error && observations.length > 0 && (
        <div className="past-observations">
          {observations.map((observation) => {
            const { role, counterpart } = relationship(observation, userId)
            return (
              <article className="past-observation" key={observation.meetingId}>
                <header>
                  <h2>
                    {observation.courseCode || 'Course unavailable'}
                    {observation.courseName ? ` · ${observation.courseName}` : ''}
                  </h2>
                  <p>
                    {role} · {counterpart} · {formatDate(observation.meetingDate)}
                    {observation.semester ? ` · ${observation.semester}` : ''}
                  </p>
                </header>
                {observation.reportExists ? (
                  <div className="observation-ratings">
                    {reportFields.map(({ field, label }) => (
                      <article className="rating-row" key={field}>
                        <h3>{label}</h3>
                        <span className="rating-score">
                          {observation[field] ?? '—'}/5
                        </span>
                      </article>
                    ))}
                    <article className="rating-row rating-row--comments">
                      <div>
                        <h3>Overall comments</h3>
                        <p>{observation.overall_comments || '—'}</p>
                      </div>
                    </article>
                  </div>
                ) : (
                  <p>No report is stored for this observation.</p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
