import { useEffect, useState } from 'react'
import { ApiError } from '../../../api/auth'
import {
  acceptObserverRequest,
  declineObserverRequest,
  getObserverRequests,
} from '../../../api/observers'
import { useAuth } from '../../../context/AuthContext'
import type { ObserverRequestResponse } from '../../../types/api'

function formatTime(time: string | null): string {
  if (!time) return ''

  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time

  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12

  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function formatDate(value: string | null): string {
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

function formatCourse(request: ObserverRequestResponse): string {
  const code = [request.course_department, request.course_number]
    .filter(Boolean)
    .join(' ')
  const course = request.section_number
    ? [code, request.section_number].filter(Boolean).join('.')
    : code

  return course || '—'
}

function formatSchedule(request: ObserverRequestResponse): string {
  const start = formatTime(request.course_start_time)
  const end = formatTime(request.course_end_time)
  const time = start && end ? `${start}-${end}` : ''
  const meeting = [request.course_day, time].filter(Boolean).join(' ')
  const place = [meeting, request.room_number].filter(Boolean).join(' - ')

  return place || '—'
}

function formatTimeLeft(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `${Math.max(minutes, 0)}m`

  return `${Math.floor(minutes / 60)}h`
}

function isAccepted(status: ObserverRequestResponse['status']) {
  return status === 'accepted' || status === 'confirmed'
}

export default function ObserverRequestsPage() {
  const { token } = useAuth()
  const [requests, setRequests] = useState<ObserverRequestResponse[]>([])
  const [selectedDates, setSelectedDates] = useState<Record<number, string>>({})
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setError('Your session is unavailable. Please sign in again.')
      return
    }

    const controller = new AbortController()

    getObserverRequests(token, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return
        setRequests(rows)
        setSelectedDates(
          Object.fromEntries(
            rows
              .filter((row) => row.selected_date)
              .map((row) => [row.meeting_id, row.selected_date as string]),
          ),
        )
        setError(null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setRequests([])
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Unable to load observation requests.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [token])

  function chooseDate(meetingId: number, date: string) {
    setSelectedDates((current) => ({ ...current, [meetingId]: date }))
  }

  async function reload(activeToken: string) {
    const rows = await getObserverRequests(activeToken)
    setRequests(rows)
  }

  async function respond(meetingId: number, status: 'accepted' | 'declined') {
    if (!token) {
      setNotice('Your session is unavailable. Please sign in again.')
      return
    }

    const request = requests.find((item) => item.meeting_id === meetingId)
    if (!request) return

    const selectedDate = selectedDates[meetingId] ?? ''
    if (status === 'accepted' && !selectedDate) {
      setNotice('Choose a date before confirming this request.')
      return
    }

    try {
      if (status === 'accepted') {
        await acceptObserverRequest(meetingId, selectedDate, token)
      } else {
        await declineObserverRequest(meetingId, token)
      }
      await reload(token)
      const name = request.observee_name ?? '—'
      setNotice(
        status === 'accepted'
          ? `You confirmed ${name}'s request.`
          : `You declined ${name}'s request.`,
      )
    } catch (caught) {
      setNotice(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to update this request.',
      )
    }
  }

  const confirmedCount = requests.filter((request) => isAccepted(request.status)).length
  const atCapacity = confirmedCount >= 3
  const visibleRequests = requests.filter((request) => request.status !== 'declined')

  return (
    <section className="screen-page participant-page requests-page">
      <header className="participant-header">
        <div>
          <h1>Observation requests</h1>
          <p>
            {atCapacity
              ? 'You already have 3 confirmed observations, so you cannot accept another request.'
              : 'Respond within 48 hours. You can confirm up to 3.'}
          </p>
        </div>
      </header>

      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {isLoading && <p>Loading observation requests...</p>}
      {error && <p role="alert">{error}</p>}

      {!isLoading && !error && (
        <div className="request-cards">
          {visibleRequests.map((request) => {
            const name = request.observee_name ?? '—'
            const course = formatCourse(request)
            const selectedDate = selectedDates[request.meeting_id] ?? ''

            return (
              <article
                className={`request-card${isAccepted(request.status) ? ' request-card--confirmed' : ''}`}
                key={request.meeting_id}
              >
                {request.status === 'pending' ? (
                  <>
                    <div className="request-card__heading">
                      <div>
                        <h2>{name} - {course}</h2>
                        <p>{formatSchedule(request)}</p>
                      </div>
                      <span className="request-expiration">Expires in {formatTimeLeft(request.minutes_left)}</span>
                    </div>
                    <fieldset className="request-date-picker">
                      <legend>Pick a date</legend>
                      <div className="request-date-options">
                        {request.offered_dates.length === 0 && <p>—</p>}
                        {request.offered_dates.map((date) => (
                          <label
                            className={`date-option${selectedDate === date ? ' date-option--selected' : ''}`}
                            key={date}
                          >
                            <input
                              checked={selectedDate === date}
                              name={`request-date-${request.meeting_id}`}
                              onChange={() => chooseDate(request.meeting_id, date)}
                              type="radio"
                              value={date}
                            />
                            {formatDate(date)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="request-card__actions">
                      <button className="button button--outline" onClick={() => respond(request.meeting_id, 'declined')} type="button">Decline</button>
                      <button
                        className="button button--primary"
                        disabled={atCapacity}
                        onClick={() => respond(request.meeting_id, 'accepted')}
                        type="button"
                      >
                        Confirm
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="request-card__confirmed-content">
                    <div>
                      <h2>{name} - {course}</h2>
                      <p>You confirmed {formatDate(request.selected_date)}</p>
                    </div>
                    <a className="text-link" href="/my-schedule">View in my schedule</a>
                  </div>
                )}
              </article>
            )
          })}
          {visibleRequests.length === 0 && (
            <p className="empty-requests">You&apos;re all caught up. New observation requests will appear here.</p>
          )}
        </div>
      )}
    </section>
  )
}
