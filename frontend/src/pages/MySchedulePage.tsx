import { useEffect, useState } from 'react'
import { ApiError } from '../api/auth'
import { getFacultySchedule } from '../api/schedule'
import { useAuth } from '../context/AuthContext'
import type {
  FacultyScheduleObservation,
  FacultyScheduleResponse,
} from '../types/schedule'
import '../styles/my-schedule.css'

// TODO(API): Replace this temporary semester with the active cycle returned by
// Flask once the active-cycle endpoint is available.
const SCHEDULE_SEMESTER = 'Fall 2026'

type ScheduleViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string; accessDenied?: boolean }
  | { status: 'ready'; schedule: FacultyScheduleResponse }

interface ScheduleTableProps {
  counterpartLabel: 'Observee' | 'Observer'
  observations: FacultyScheduleObservation[]
}

function dateValue(date: string) {
  return Date.parse(`${date}T00:00:00Z`)
}

function formatDate(date: string) {
  const value = dateValue(date)
  if (Number.isNaN(value)) return date

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value)
}

function startOfToday() {
  const today = new Date()
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
}

function splitByDate(observations: FacultyScheduleObservation[]) {
  const today = startOfToday()
  const upcoming = observations
    .filter((observation) => dateValue(observation.observationDate) >= today)
    .sort(
      (left, right) =>
        dateValue(left.observationDate) - dateValue(right.observationDate),
    )
  const past = observations
    .filter((observation) => dateValue(observation.observationDate) < today)
    .sort(
      (left, right) =>
        dateValue(right.observationDate) - dateValue(left.observationDate),
    )

  return { upcoming, past }
}

function ScheduleTable({
  counterpartLabel,
  observations,
}: ScheduleTableProps) {
  return (
    <div className="screen-table-scroll schedule-table-scroll">
      <table className="screen-table schedule-table">
        <thead>
          <tr>
            <th scope="col">Observation date</th>
            <th scope="col">Course</th>
            <th scope="col">{counterpartLabel}</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {observations.map((observation) => (
            <tr key={observation.id}>
              <td>{formatDate(observation.observationDate)}</td>
              <td>
                <strong>{observation.course.code}</strong>
                {observation.course.title && (
                  <span>{observation.course.title}</span>
                )}
              </td>
              <td>{observation.counterpartName}</td>
              <td>
                {observation.status ? (
                  <span className="schedule-status">{observation.status}</span>
                ) : (
                  <span aria-label="Status not provided">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScheduleSection({
  title,
  description,
  counterpartLabel,
  observations,
}: {
  title: string
  description: string
  counterpartLabel: 'Observee' | 'Observer'
  observations: FacultyScheduleObservation[]
}) {
  const { upcoming, past } = splitByDate(observations)

  return (
    <section className="schedule-section">
      <header className="schedule-section__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>

      {observations.length === 0 ? (
        <p className="schedule-empty">No scheduled observations were returned.</p>
      ) : (
        <div className="schedule-periods">
          <section aria-labelledby={`${counterpartLabel}-upcoming-heading`}>
            <h3 id={`${counterpartLabel}-upcoming-heading`}>Upcoming</h3>
            {upcoming.length > 0 ? (
              <ScheduleTable
                counterpartLabel={counterpartLabel}
                observations={upcoming}
              />
            ) : (
              <p className="schedule-empty schedule-empty--compact">
                No upcoming observations.
              </p>
            )}
          </section>

          <section aria-labelledby={`${counterpartLabel}-past-heading`}>
            <h3 id={`${counterpartLabel}-past-heading`}>Past</h3>
            {past.length > 0 ? (
              <ScheduleTable
                counterpartLabel={counterpartLabel}
                observations={past}
              />
            ) : (
              <p className="schedule-empty schedule-empty--compact">
                No past observations.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default function MySchedulePage() {
  const { token } = useAuth()
  const [viewState, setViewState] = useState<ScheduleViewState>(() => (
    token
      ? { status: 'loading' }
      : {
          status: 'error',
          message: 'Your session is unavailable. Please sign in again.',
        }
  ))
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    void getFacultySchedule(SCHEDULE_SEMESTER, token, controller.signal)
      .then((schedule) => {
        if (!controller.signal.aborted) {
          setViewState({ status: 'ready', schedule })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setViewState({
          status: 'error',
          accessDenied: error instanceof ApiError && error.status === 403,
          message: error instanceof ApiError && error.status === 403
            ? 'My Schedule is available only to Faculty users.'
            : error instanceof Error
              ? error.message
              : 'The schedule could not be loaded.',
        })
      })

    return () => controller.abort()
  }, [loadAttempt, token])

  return (
    <section className="screen-page participant-page my-schedule-page">
      <header className="participant-header">
        <div>
          <h1>My schedule</h1>
          <p>
            View observation dates for the observations you are conducting and
            the observations scheduled for you.
          </p>
        </div>
      </header>

      {viewState.status === 'loading' && (
        <section aria-live="polite" className="schedule-state schedule-state--loading">
          <span className="schedule-loading-indicator" aria-hidden="true" />
          <div>
            <h2>Loading your schedule</h2>
            <p>Retrieving your observation assignments.</p>
          </div>
        </section>
      )}

      {viewState.status === 'error' && (
        <section className="schedule-state schedule-state--error" role="alert">
          <span className="schedule-state__eyebrow">
            {viewState.accessDenied ? 'Faculty access required' : 'Unable to load schedule'}
          </span>
          <h2>
            {viewState.accessDenied
              ? 'You do not have access to My Schedule'
              : 'We couldn\'t retrieve your observations'}
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
        <div className="schedule-sections">
          <ScheduleSection
            counterpartLabel="Observee"
            description="Observation assignments where you are serving as the Observer."
            observations={viewState.schedule.conducting}
            title="Observations I’m Conducting"
          />
          <ScheduleSection
            counterpartLabel="Observer"
            description="Observation appointments where you are the Observee."
            observations={viewState.schedule.scheduledForMe}
            title="My Scheduled Observations"
          />
        </div>
      )}
    </section>
  )
}
