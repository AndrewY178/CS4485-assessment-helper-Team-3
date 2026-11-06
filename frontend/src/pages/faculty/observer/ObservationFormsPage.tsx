import { useEffect, useState } from 'react'
import { ApiError } from '../../../api/auth'
import {
  getFacultySchedule,
  TEMPORARY_SCHEDULE_SEMESTER,
} from '../../../api/schedule'
import { useAuth } from '../../../context/AuthContext'
import type { FacultyScheduleObservation } from '../../../types/schedule'
import '../../../styles/observation-forms.css'

type ObservationFormsState =
  | { status: 'loading' }
  | { status: 'error'; message: string; accessDenied?: boolean }
  | { status: 'ready'; observations: FacultyScheduleObservation[] }

function formatDate(value: string) {
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed)) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function reportStatus(observation: FacultyScheduleObservation) {
  return observation.status === 'Completed' ? 'Submitted' : 'Pending'
}

export default function ObservationFormsPage() {
  const { token } = useAuth()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [viewState, setViewState] = useState<ObservationFormsState>(() => (
    token
      ? { status: 'loading' }
      : {
          status: 'error',
          message: 'Your session is unavailable. Please sign in again.',
        }
  ))

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    void getFacultySchedule(
      TEMPORARY_SCHEDULE_SEMESTER,
      token,
      controller.signal,
    )
      .then((schedule) => {
        if (!controller.signal.aborted) {
          setViewState({ status: 'ready', observations: schedule.conducting })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const accessDenied = error instanceof ApiError && error.status === 403
        setViewState({
          status: 'error',
          accessDenied,
          message: accessDenied
            ? 'Observation Forms is available only to Faculty users.'
            : error instanceof Error
              ? error.message
              : 'Observation forms could not be loaded.',
        })
      })

    return () => controller.abort()
  }, [loadAttempt, token])

  return (
    <section className="screen-page participant-page observation-forms-page">
      <header className="participant-header">
        <div>
          <h1>Observation forms</h1>
          <p>
            Review reports for observations you are assigned to conduct.
          </p>
        </div>
      </header>

      {viewState.status === 'loading' && (
        <section aria-live="polite" className="observation-forms-state">
          <span aria-hidden="true" className="observation-forms-loading" />
          <div>
            <h2>Loading observation forms</h2>
            <p>Retrieving your Observer assignments.</p>
          </div>
        </section>
      )}

      {viewState.status === 'error' && (
        <section className="observation-forms-state observation-forms-state--error" role="alert">
          <span className="observation-forms-state__eyebrow">
            {viewState.accessDenied ? 'Faculty access required' : 'Unable to load forms'}
          </span>
          <h2>
            {viewState.accessDenied
              ? 'You do not have access to Observation Forms'
              : 'We couldn\'t retrieve your Observer assignments'}
          </h2>
          <p>{viewState.message}</p>
          {!viewState.accessDenied && (
            <button
              className="button button--outline"
              onClick={() => {
                setViewState({ status: 'loading' })
                setLoadAttempt((attempt) => attempt + 1)
              }}
              type="button"
            >
              Try again
            </button>
          )}
        </section>
      )}

      {viewState.status === 'ready' && (
        <section aria-labelledby="observation-forms-list-title">
          <div className="observation-forms-heading">
            <div>
              <h2 id="observation-forms-list-title">Assigned observations</h2>
              <p>{TEMPORARY_SCHEDULE_SEMESTER}</p>
            </div>
            <p className="observation-forms-note">
              Form completion and viewing will be enabled when the report workflow is connected.
            </p>
          </div>

          {viewState.observations.length === 0 ? (
            <p className="observation-forms-empty">
              No confirmed Observer assignments were found for this semester.
            </p>
          ) : (
            <div className="screen-table-scroll observation-forms-table-scroll">
              <table className="screen-table observation-forms-table">
                <thead>
                  <tr>
                    <th scope="col">Observee</th>
                    <th scope="col">Course</th>
                    <th scope="col">Observation date</th>
                    <th scope="col">Report</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {viewState.observations.map((observation) => {
                    const status = reportStatus(observation)
                    return (
                      <tr key={observation.id}>
                        <td>{observation.counterpartName}</td>
                        <td>
                          <strong>{observation.course.code}</strong>
                          {observation.course.title && (
                            <span>{observation.course.title}</span>
                          )}
                        </td>
                        <td>{formatDate(observation.observationDate)}</td>
                        <td>
                          <span className={`observation-form-status observation-form-status--${status.toLowerCase()}`}>
                            {status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="observation-form-entry"
                            disabled
                            title="The observation report workflow is not connected yet."
                            type="button"
                          >
                            {status === 'Submitted' ? 'View form' : 'Complete form'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
