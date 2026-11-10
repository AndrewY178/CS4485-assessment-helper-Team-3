import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/auth'
import {
  getFacultyCourses,
  TEMPORARY_SCHEDULE_SEMESTER,
  type FacultyCourse,
} from '../../api/schedule'
import { getSignupDates, saveSignupDates } from '../../api/signupDates'
import { useAuth } from '../../context/AuthContext'
import { AppLink } from '../../context/NavigationContext'

const initialDates: string[] = []

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function FacultyStatusPage() {
  const [courses, setCourses] = useState<FacultyCourse[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [dates, setDates] = useState(initialDates)
  const [newDate, setNewDate] = useState('')
  const [notice, setNotice] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { token } = useAuth()

  // show the dates this person already saved, if any
  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    void getFacultyCourses(TEMPORARY_SCHEDULE_SEMESTER, token, controller.signal)
      .then((available) => {
        if (controller.signal.aborted) return
        setCourses(available.courses)
        setSelectedCourse(available.courses[0]?.course_id ?? null)
        return getSignupDates(TEMPORARY_SCHEDULE_SEMESTER, token, controller.signal)
      })
      .then((saved) => {
        if (!saved || controller.signal.aborted) return
        setSelectedCourse(saved.course_id)
        setDates(saved.dates)
        setSubmitted(true)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // no sign-up yet (404) is expected, so only show other problems
        if (error instanceof ApiError && error.status === 404) return
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
      const saved = await saveSignupDates(TEMPORARY_SCHEDULE_SEMESTER, selectedCourse, dates, token)
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
    setDates(initialDates)
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
          <p>Assistant Professor - evaluated every year. Last observed Fall 2025</p>
          <p className="evaluation-status-card__deadline">Sign up by [Oct 24]</p>
        </section>

        <section aria-labelledby="past-observations-title" className="past-observations">
          <h2 id="past-observations-title">Past observations</h2>
          <p>
            <span>Fall 2025 - CS 1337</span>
            <AppLink to="/my-observation">View</AppLink>
          </p>
          <p>
            <span>Fall 2024 - CS 2336</span>
            <AppLink to="/my-observation">View</AppLink>
          </p>
        </section>
      </div>

      <form className="observee-signup-form" onSubmit={submitSignUp}>
        <header className="observee-signup-header">
          <h2>Sign up to be observed</h2>
          <p>Pick one course you teach this semester. Signing up also adds you to the observer pool.</p>
        </header>

        <fieldset className="course-picker">
          <legend>Your Fall 2026 courses</legend>
          <div className="course-options">
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
                  value={course.course_id}
                />
                <span>
                  <strong>{course.department} {course.course_number}.{course.section_number} - {course.course_name}</strong>
                  <small>{course.course_day ?? 'Schedule unavailable'} {course.course_start_time ?? ''}-{course.course_end_time ?? ''} {course.room_number ? `- ${course.room_number}` : ''}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="observee-date-picker">
          <legend>Dates you can be observed</legend>
          <p>Must be class days before the observation deadline. [Nov 21].</p>
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
                max="2026-11-21"
                min="2026-11-02"
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
