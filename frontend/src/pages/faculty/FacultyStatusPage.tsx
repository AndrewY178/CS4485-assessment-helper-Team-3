import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/auth'
import { getFacultyCourses } from '../../api/courses'
import { getCycleDeadline } from '../../api/cycles'
import { getFacultyStatus, type FacultyStatusResponse } from '../../api/facultyStatus'
import { getPastObservations } from '../../api/pastObservations'
import { TEMPORARY_SCHEDULE_SEMESTER } from '../../api/schedule'
import { getSignupDates, saveSignupDates } from '../../api/signupDates'
import { getUsers } from '../../api/users'
import { useAuth } from '../../context/AuthContext'
import { AppLink } from '../../context/NavigationContext'
import type { CycleDeadlineResponse, FacultyCourse, PastObservation } from '../../types/api'

function localIso(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

function upcomingDates(lastDay: string): string[] {
  const start = new Date()
  start.setHours(12, 0, 0, 0)
  const dates: string[] = []
  for (let offset = 0; dates.length < 3 && offset < 40; offset += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + offset)
    const iso = localIso(day)
    if (lastDay && iso > lastDay) break
    dates.push(iso)
  }
  return dates
}

function formatStoredDate(value: string) {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function courseTitle(course: FacultyCourse) {
  const code = [course.department, course.course_number, course.section_number].filter(Boolean).join(' ')
  return course.course_name ? `${code} - ${course.course_name}` : code
}

function courseSchedule(course: FacultyCourse) {
  const time = [course.course_start_time?.slice(0, 5), course.course_end_time?.slice(0, 5)]
    .filter(Boolean)
    .join('-')
  const when = [course.course_day, time].filter(Boolean).join(' ')
  return [when, course.room_number].filter(Boolean).join(' - ')
}

function rankLabel(rank: string): string {
  if (rank === 'Assistant') return 'Assistant professor'
  if (rank === 'Associate') return 'Associate professor'
  if (rank === 'Full') return 'Professor'
  return rank || 'No rank stored'
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function FacultyStatusPage() {
  const [courses, setCourses] = useState<FacultyCourse[]>([])
  const [status, setStatus] = useState<FacultyStatusResponse | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [newDate, setNewDate] = useState('')
  const [notice, setNotice] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [rankSummary, setRankSummary] = useState('Loading your rank...')
  const [deadline, setDeadline] = useState<CycleDeadlineResponse | null>(null)
  const [pastObservations, setPastObservations] = useState<PastObservation[]>([])
  const { token, userId } = useAuth()
  const observationDeadline = deadline?.observation_deadline?.slice(0, 10) ?? ''

  useEffect(() => {
    const controller = new AbortController()
    getUsers(controller.signal)
      .then((users) => {
        if (controller.signal.aborted) return
        const me = users.find((user) => String(user.id) === userId)
        if (!me) {
          setRankSummary('Your rank is not stored.')
          return
        }
        const lastObserved = me.last_sem_observed || '—'
        setRankSummary(
          `${rankLabel(me.prof_rank || '')} - evaluated every year. Last observed ${lastObserved}`,
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setRankSummary(
          error instanceof Error ? error.message : 'Your rank could not be loaded.',
        )
      })

    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    getFacultyCourses(TEMPORARY_SCHEDULE_SEMESTER, token, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return
        setCourses(rows)
        setSelectedCourse((current) => current ?? rows[0]?.course_id ?? null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setNotice(error instanceof Error ? error.message : 'Your courses could not be loaded.')
      })
    getCycleDeadline(TEMPORARY_SCHEDULE_SEMESTER, controller.signal)
      .then((stored) => {
        if (!controller.signal.aborted) {
          setDeadline(stored)
          const storedObservationDeadline = stored.observation_deadline?.slice(0, 10) ?? ''
          if (storedObservationDeadline) {
            setDates((current) => (
              current.length > 0 ? current : upcomingDates(storedObservationDeadline)
            ))
          }
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 404) return
        setNotice(error instanceof Error ? error.message : 'The cycle deadline could not be loaded.')
      })
    getPastObservations(token, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setPastObservations(response.observations)
      })
      .catch(() => {
        if (!controller.signal.aborted) setPastObservations([])
      })
    return () => controller.abort()
  }, [token])

  // show the dates this person already saved, if any
  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    void getFacultyStatus(token, controller.signal)
      .then((facultyStatus) => {
        if (controller.signal.aborted) return null
        setStatus(facultyStatus)
        return Promise.all([
          getFacultyCourses(facultyStatus.semester, token, controller.signal),
          getSignupDates(facultyStatus.semester, token, controller.signal)
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 404) {
              return { course_id: null, dates: [] }
            }
            throw error
          })
          ,
        ])
      })
      .then((result) => {
        if (!result || controller.signal.aborted) return

        const [available, saved] = result
        if (controller.signal.aborted) return
        setCourses(available)
        setSelectedCourse(saved.course_id)
        setDates(saved.dates)
        setSubmitted(true)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // no sign-up yet (404) is expected, so only show other problems
        setNotice(error instanceof Error ? error.message : 'Your saved dates could not be loaded.')
      })

    return () => controller.abort()
  }, [token])

  function addDate() {
    if (!newDate || dates.includes(newDate)) return
    setDates((current) => [...current, newDate].sort())
    setNewDate('')
  }

  async function submitSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedCourse === null) {
      setNotice('Choose a course before submitting your sign-up.')
      return
    }
    if (dates.length === 0) {
      setNotice('Add at least one date when you can be observed.')
      return
    }
    if (!token) {
      setNotice('Your session is unavailable. Please sign in again.')
      return
    }
    try {
      if (!status) {
        setNotice('Your faculty status is unavailable. Please try again.')
        return
      }
      const saved = await saveSignupDates(status.semester, selectedCourse, dates, token)
      setDates(saved.dates)
      setSubmitted(true)
      setNotice('Your sign-up has been saved. You can update your course and dates until the deadline.')
    } catch (error) {
      setSubmitted(false)
      setNotice(error instanceof Error ? error.message : 'Your sign-up could not be saved.')
    }
  }

  function cancelSignUp() {
    setSelectedCourse(courses[0]?.course_id ?? null)
    setDates(observationDeadline ? upcomingDates(observationDeadline) : [])
    setNewDate('')
    setSubmitted(false)
    setNotice('Your sign-up changes were canceled.')
  }

  return (
    <section className="observee-status-page">
      <div className="observee-status-sidebar">
        <section aria-labelledby="evaluation-status-title" className="evaluation-status-card">
          <p className="evaluation-status-card__eyebrow" id="evaluation-status-title">Evaluation status</p>
          <h1>Due this semester</h1>
          <p>{rankSummary}</p>
          <p className="evaluation-status-card__deadline">
            {deadline
              ? `Sign up by ${formatStoredDate(deadline.signup_deadline)}`
              : 'Sign-up deadline is not available.'}
          </p>
        </section>

        <section aria-labelledby="past-observations-title" className="past-observations">
          <h2 id="past-observations-title">Past observations</h2>
          {pastObservations.length === 0 && <p>No past observations yet.</p>}
          {pastObservations.map((observation) => (
            <p key={observation.meetingId}>
              <span>
                {[observation.semester, observation.courseCode].filter(Boolean).join(' - ') || 'Observation'}
              </span>
              <AppLink to="/my-observation">View</AppLink>
            </p>
          ))}
        </section>
      </div>

      <form className="observee-signup-form" onSubmit={submitSignUp}>
        <header className="observee-signup-header">
          <h2>Sign up to be observed</h2>
          <p>Pick one course you teach this semester. Signing up also adds you to the observer pool.</p>
        </header>

        <fieldset className="course-picker">
          <legend>Your {TEMPORARY_SCHEDULE_SEMESTER} courses</legend>
          <div className="course-options">
            {courses.length === 0 && <p>No courses are stored for you this semester.</p>}
            {courses.map((course) => (
              <label
                className={`course-option${selectedCourse === course.course_id ? ' course-option--selected' : ''}`}
                key={course.course_id}
              >
                <input
                  checked={selectedCourse === course.course_id}
                  name="course"
                  onChange={() => setSelectedCourse(course.course_id)}
                  type="radio"
                  value={String(course.course_id)}
                />
                <span>
                  <strong>{courseTitle(course)}</strong>
                  <small>{courseSchedule(course)}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="observee-date-picker">
          <legend>Dates you can be observed</legend>
          <p>
            {observationDeadline
              ? `Must be class days before the observation deadline, ${formatStoredDate(observationDeadline)}.`
              : 'The observation deadline is not available yet.'}
          </p>
          <div className="observee-date-list">
            {dates.map((date) => (
              <div className="observee-date-row" key={date}>
                <span>{formatDate(date)}</span>
                <button
                  aria-label={`Remove ${formatDate(date)}`}
                  onClick={() => setDates((current) => current.filter((item) => item !== date))}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="observee-date-add">
              <input
                aria-label="Add an available observation date"
                max={observationDeadline || undefined}
                min={localIso(new Date())}
                onChange={(event) => setNewDate(event.target.value)}
                type="date"
                value={newDate}
              />
              <button disabled={!newDate || dates.includes(newDate)} onClick={addDate} type="button">
                + Add date
              </button>
            </div>
          </div>
        </fieldset>

        {notice && (
          <p className={`observee-signup-notice${submitted ? ' observee-signup-notice--success' : ''}`} role="status">
            {notice}
          </p>
        )}

        <footer className="observee-signup-actions">
          <button className="button button--outline" onClick={cancelSignUp} type="button">
            Cancel
          </button>
          <button className="button button--primary" type="submit">
            {submitted ? 'Update sign-up' : 'Submit sign-up'}
          </button>
        </footer>
      </form>
    </section>
  )
}
