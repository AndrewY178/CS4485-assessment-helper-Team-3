import { useEffect, useState } from 'react'
import { ApiError } from '../../../api/auth'
import { getObservees } from '../../../api/observees'
import { getAcceptedObservers, getObserverList, sendObserverRequests } from '../../../api/observers'
import { useAuth } from '../../../context/AuthContext'
import type {
  AcceptedObserverResponse,
  ObserveeResponse,
  ObserverCandidateResponse,
} from '../../../types/api'

function formatTime(time: string | null): string {
  if (!time) return '—'

  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time

  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12

  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function formatObserveeCourse(observee: ObserveeResponse): string {
  const code = [observee.course_department, observee.course_number]
    .filter(Boolean)
    .join(' ')
  const course = observee.section_number
    ? [code, observee.section_number].filter(Boolean).join('.')
    : code
  const start = formatTime(observee.course_start_time)
  const end = formatTime(observee.course_end_time)
  const time = start !== '—' && end !== '—' ? `${start}–${end}` : ''
  const meeting = [observee.course_day, time].filter(Boolean).join(' ')
  const label = [course, meeting].filter(Boolean).join(' - ')

  return label || '—'
}

function formatSelectedDate(value: string | null): string {
  if (!value) return '—'

  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed)) return value

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

export default function MyObserversPage() {
  const { userId } = useAuth()
  const [observers, setObservers] = useState<ObserverCandidateResponse[]>([])
  const [accepted, setAccepted] = useState<AcceptedObserverResponse[]>([])
  const [courseLabel, setCourseLabel] = useState('—')
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupSemester, setSignupSemester] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadObservers() {
      if (!userId) {
        if (!cancelled) {
          setObservers([])
          setAccepted([])
          setCourseLabel('—')
          setError('Your session is unavailable. Please sign in again.')
          setIsLoading(false)
        }
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const observees = await getObservees()
        const me = observees.find((row) => String(row.id) === String(userId))
        const signupSemester = me?.signup_sem ?? ''

        if (!me || !signupSemester) {
          if (!cancelled) {
            setObservers([])
            setAccepted([])
            setCourseLabel('—')
            setError('No sign-up was found for your account.')
          }
          return
        }

        const [available, acceptedObservers] = await Promise.all([
          getObserverList(String(me.id), signupSemester),
          getAcceptedObservers(String(me.id), signupSemester),
        ])

        if (!cancelled) {
          setObservers(available)
          setAccepted(acceptedObservers)
          setCourseLabel(formatObserveeCourse(me))
          setSignupSemester(signupSemester)
          setSelected([])
        }
      } catch (caught) {
        if (!cancelled) {
          setObservers([])
          setAccepted([])
          setCourseLabel('—')
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'Unable to load observers.',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadObservers()

    return () => {
      cancelled = true
    }
  }, [userId])

  function toggleObserver(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((observerId) => observerId !== id)
        : [...current, id],
    )
  }

  async function sendRequests() {
    if (!userId || !signupSemester) {
      setNotice('No sign-up was found for your account.')
      return
    }
    if (selected.length === 0) {
      setNotice('Select at least one observer.')
      return
    }

    try {
      setIsSending(true)
      const result = await sendObserverRequests(userId, signupSemester, selected)
      const [available, acceptedObservers] = await Promise.all([
        getObserverList(userId, signupSemester),
        getAcceptedObservers(userId, signupSemester),
      ])
      setObservers(available)
      setAccepted(acceptedObservers)
      setSelected([])

      const sentNames = result.sent
        .map((observer) => observer.professor_name ?? '—')
        .join(', ')
      const saved = `Request sent to ${sentNames}.`
      setNotice(
        result.emailError
          ? `${saved} The email could not be sent because notification email is not configured.`
          : saved,
      )
    } catch (caught) {
      setNotice(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to send the request.',
      )
    } finally {
      setIsSending(false)
    }
  }

  function requestStatusLabel(
    status: string | null | undefined,
    acceptedObserver: AcceptedObserverResponse | undefined,
  ) {
    if (acceptedObserver) return formatSelectedDate(acceptedObserver.selected_date)
    if (status === 'pending') return 'Pending'
    if (status === 'declined') return 'Declined'
    if (status === 'expired') return 'Expired'
    if (status === 'confirmed') return 'Confirmed'
    if (status === 'not_selected') return 'Not selected'
    return '—'
  }

  const acceptedById = new Map(
    accepted.map((observer) => [String(observer.observer_id), observer]),
  )
  const confirmedName = accepted
    .map((observer) => observer.professor_name ?? '—')
    .join(', ')
  const confirmedDate = accepted
    .map((observer) => formatSelectedDate(observer.selected_date))
    .join(', ')

  return (
    <section className="screen-page participant-page observers-page">
      <header className="participant-header">
        <div>
          <p className="participant-course">{courseLabel}</p>
          <h1>Your observer list is ready</h1>
          <p>Send a request to one or more observers. Requests expire after 48 hours.</p>
        </div>
      </header>

      {accepted.length > 0 && (
        <section aria-label="Confirmed observer" className="confirmed-observer-banner">
          <div>
            <strong>
              {confirmedName}{' '}
              {accepted.length === 1 ? 'is your selected observer' : 'are your selected observers'}
            </strong>
            <p>
              {accepted.length === 1
                ? `Your observation is set for ${confirmedDate}.`
                : `Your observations are set for ${confirmedDate}.`}
            </p>
          </div>
        </section>
      )}

      {notice && <p className="inline-notice" role="status">{notice}</p>}

      {isLoading && <p>Loading your observers...</p>}

      {error && <p role="alert">{error}</p>}

      {!isLoading && !error && observers.length === 0 && (
        <p>No observers were found for your sign-up.</p>
      )}

      {!isLoading && !error && observers.length > 0 && (
        <div className="observer-list-scroll">
          <table className="screen-table observer-list-table">
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Select</span></th>
                <th scope="col">Observer</th>
                <th scope="col">Teaches</th>
                <th scope="col">Request status</th>
              </tr>
            </thead>
            <tbody>
              {observers.map((observer) => {
                const observerId = String(observer.observer_id)
                const name = observer.professor_name ?? '—'
                const acceptedObserver = acceptedById.get(observerId)

                return (
                  <tr key={observerId}>
                    <td>
                      <input
                        aria-label={`Select ${name}`}
                        checked={selected.includes(observerId)}
                        onChange={() => toggleObserver(observerId)}
                        type="checkbox"
                      />
                    </td>
                    <td>{name}</td>
                    <td>
                      {/* TODO: needs backend field */}
                      —
                    </td>
                    <td>
                      {requestStatusLabel(observer.status, acceptedObserver)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="observer-list-actions">
        <p>
          {/* TODO: needs backend field */}
          Requests include your dates: —
        </p>
        <button className="button button--outline" disabled={isSending} onClick={sendRequests} type="button">
          {isSending ? 'Sending request...' : 'Send request to selected'}
        </button>
      </footer>

      <p className="observer-list-help">Nobody confirmed? <a href="mailto:assessment@utdallas.edu">Let the Assessment Committee know</a></p>
    </section>
  )
}
