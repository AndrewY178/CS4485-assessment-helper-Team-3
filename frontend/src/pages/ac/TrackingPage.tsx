import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ApiError } from '../../api/auth'
import { getObservationTracking } from '../../api/tracking'
import { useAuth } from '../../context/AuthContext'
import type {
  TrackingObservation,
  TrackingResponse,
  TrackingStatus,
} from '../../types/tracking'

// TODO(API): Replace this with the active semester from Cycle Setup once that
// endpoint is available. Tracking records themselves always come from Flask.
const TRACKING_SEMESTER = 'Fall 2026'

const statusLabels: Record<TrackingStatus, string> = {
  'observer-needed': 'Observer needed',
  scheduled: 'Scheduled',
  'report-pending': 'Report pending',
  completed: 'Completed',
  'needs-attention': 'Needs attention',
}

const summaryStatuses: TrackingStatus[] = [
  'observer-needed',
  'scheduled',
  'report-pending',
  'completed',
  'needs-attention',
]

function stageClass(status: TrackingStatus) {
  return status === 'needs-attention'
    ? 'observation-stage observation-stage--warning'
    : 'observation-stage'
}

function formatDate(date: string | null) {
  if (!date) return '—'
  const parsed = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed)) return date

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function matchesSearch(observation: TrackingObservation, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return true

  return [
    observation.observeeName,
    observation.courseCode,
    observation.courseName,
    observation.observerName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query)
}

export default function TrackingPage() {
  const { token } = useAuth()
  const [tracking, setTracking] = useState<TrackingResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<TrackingStatus | 'all'>('all')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadTracking() {
      if (!token) {
        setError('Your session is unavailable. Please sign in again.')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const response = await getObservationTracking(
          TRACKING_SEMESTER,
          token,
          controller.signal,
        )
        if (!controller.signal.aborted) {
          setTracking(response)
        }
      } catch (loadError) {
        if (controller.signal.aborted) return
        setTracking(null)
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : 'Unable to load observation tracking.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadTracking()
    return () => controller.abort()
  }, [loadAttempt, token])

  const observations = useMemo(
    () => tracking?.observations ?? [],
    [tracking],
  )
  const filteredObservations = useMemo(
    () => observations.filter((observation) => (
      matchesSearch(observation, search)
      && (selectedStatus === 'all' || observation.status === selectedStatus)
    )),
    [observations, search, selectedStatus],
  )
  const summary = useMemo(
    () => summaryStatuses.map((status) => ({
      label: statusLabels[status],
      status,
      value: observations.filter((observation) => observation.status === status).length,
    })),
    [observations],
  )

  return (
    <section className="screen-page tracking-page">
      <header className="screen-header tracking-header">
        <div>
          <h1>Observation tracking</h1>
          <p>{TRACKING_SEMESTER} · Live observation status</p>
        </div>
      </header>

      {isLoading && (
        <section aria-live="polite" className="tracking-state">
          <div aria-hidden="true" className="tracking-loading-indicator" />
          <div>
            <strong>Loading observation tracking</strong>
            <p>Retrieving the latest observation records.</p>
          </div>
        </section>
      )}

      {!isLoading && error && (
        <section className="tracking-state tracking-state--error" role="alert">
          <div>
            <strong>Observation tracking is unavailable</strong>
            <p>{error}</p>
          </div>
          <button
            className="button button--outline"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            type="button"
          >
            Retry
          </button>
        </section>
      )}

      {!isLoading && !error && tracking && (
        <>
          <section aria-label="Observation status summary" className="tracking-summary">
            {summary.map(({ label, status, value }) => (
              <div
                className={`tracking-summary__item${status === 'needs-attention' ? ' tracking-summary__item--warning' : ''}`}
                key={status}
              >
                <p>{label}</p>
                <span>{value}</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="observations-heading" className="observations-section">
            <h2 id="observations-heading">All observations</h2>
            <div className="observations-toolbar">
              <label className="search-field observations-search">
                <Search aria-hidden="true" className="search-field__icon" />
                <span className="visually-hidden">Search observee or observer</span>
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search observee or observer"
                  type="search"
                  value={search}
                />
              </label>
              <label className="stage-filter-select">
                <span>Stage filter</span>
                <select
                  onChange={(event) => setSelectedStatus(event.target.value as TrackingStatus | 'all')}
                  value={selectedStatus}
                >
                  <option value="all">All stages</option>
                  {summaryStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="screen-table-scroll observations-table-scroll">
              <table className="screen-table observations-table">
                <thead>
                  <tr>
                    <th scope="col">Observee</th>
                    <th scope="col">Course</th>
                    <th scope="col">Observer</th>
                    <th scope="col">Date</th>
                    <th scope="col">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredObservations.map((observation) => (
                    <tr key={`${observation.observeeId}-${observation.meetingId ?? 'unassigned'}`}>
                      <td>{observation.observeeName}</td>
                      <td>{observation.courseCode ?? 'Not selected'}</td>
                      <td>{observation.observerName ?? '—'}</td>
                      <td>{formatDate(observation.meetingDate)}</td>
                      <td className={stageClass(observation.status)}>
                        {statusLabels[observation.status]}
                      </td>
                    </tr>
                  ))}
                  {filteredObservations.length === 0 && (
                    <tr>
                      <td className="screen-table__empty" colSpan={5}>
                        {observations.length === 0
                          ? `No observation records were found for ${tracking.signupSemester}.`
                          : 'No observations match your search and stage filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
