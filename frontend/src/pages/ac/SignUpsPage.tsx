import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ApiError } from '../../api/auth'
import { updateProfessorRank } from '../../api/professorRank'
import {
  getSignUpRequests,
  type SignUpRequest,
  type SignUpStatus,
} from '../../api/signups'
import { useAuth } from '../../context/AuthContext'

const pageSize = 8

export default function SignUpsPage() {
  const { token } = useAuth()
  const [signUpRequests, setSignUpRequests] = useState<SignUpRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rankError, setRankError] = useState('')
  const [lastChange, setLastChange] = useState('')
  const [savingRankId, setSavingRankId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'All statuses' | SignUpStatus>('All statuses')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadObservees() {
      try {
        setIsLoading(true)
        setError(null)

        if (!token) {
          throw new Error('Your session is unavailable. Please sign in again.')
        }
        const requests = await getSignUpRequests(token)

        if (!cancelled) {
          setSignUpRequests(requests)
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof ApiError
              ? error.message
              : 'Unable to load sign-up requests.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadObservees()

    return () => {
      cancelled = true
    }
  }, [token])

  const rankOptions = useMemo(() => {
    return [...new Set(signUpRequests.map((request) => request.level).filter(Boolean))].sort()
  }, [signUpRequests])

  async function changeRank(request: SignUpRequest, profRank: string) {
    if (!profRank || profRank === request.level) return
    if (!token) {
      setRankError('Your session is unavailable. Please sign in again.')
      return
    }

    setRankError('')
    setSavingRankId(request.id)
    try {
      const updated = await updateProfessorRank(request.id, profRank, token)
      setSignUpRequests((current) =>
        current.map((item) =>
          item.id === request.id ? { ...item, level: updated.prof_rank } : item,
        ),
      )
      setLastChange(`${request.name} is now ${updated.prof_rank}.`)
    } catch (saveError) {
      setRankError(
        saveError instanceof ApiError
          ? saveError.message
          : 'Unable to update this professor rank.',
      )
    } finally {
      setSavingRankId(null)
    }
  }

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return signUpRequests.filter((request) => {
      const matchesSearch =
        !query ||
        `${request.name} ${request.email} ${request.course}`
          .toLowerCase()
          .includes(query)
      return matchesSearch && (status === 'All statuses' || request.status === status)
    })
  }, [search, signUpRequests, status])

  const pageCount = Math.ceil(filteredRequests.length / pageSize)
  const visibleRequests = filteredRequests.slice(
    page * pageSize,
    (page + 1) * pageSize,
  )
  const firstVisible = filteredRequests.length ? page * pageSize + 1 : 0
  const lastVisible = Math.min((page + 1) * pageSize, filteredRequests.length)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(0)
  }

  function updateStatus(value: 'All statuses' | SignUpStatus) {
    setStatus(value)
    setPage(0)
  }

  return (
    <section className="screen-page signups-page">
      <header className="screen-header signups-header">
        <div>
          <h1>Sign-up requests</h1>
          <p>
            {signUpRequests.length
              ? `${signUpRequests.length} faculty signed up for ${signUpRequests[0].semester}.`
              : 'No faculty have signed up for a cycle yet.'}
          </p>
        </div>
        <div className="screen-controls">
          <label className="search-field">
            <Search aria-hidden="true" className="search-field__icon" />
            <span className="visually-hidden">Search by name, course, or email</span>
            <input
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by name, course or email"
              type="search"
              value={search}
            />
          </label>
          <label className="visually-hidden" htmlFor="signup-status">
            Filter by status
          </label>
          <select
            id="signup-status"
            onChange={(event) =>
              updateStatus(event.target.value as 'All statuses' | SignUpStatus)
            }
            value={status}
          >
            <option>All statuses</option>
            <option>Due</option>
            <option>Overdue</option>
          </select>
        </div>
      </header>
      {lastChange && <p role="status">{lastChange}</p>}
      {rankError && <p className="form-error" role="alert">{rankError}</p>}

      <div className="screen-table-card">
        <div className="screen-table-scroll">
          <table className="screen-table signups-table">
            <thead>
              <tr>
                <th scope="col">Observee</th>
                <th scope="col">Email</th>
                <th scope="col">Level</th>
                <th scope="col">Course</th>
                <th scope="col">Time</th>
                <th scope="col">Observee status</th>
              </tr>
            </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="screen-table__empty" colSpan={6}>
                      Loading sign-up requests...
                    </td>
                  </tr>
                )}
              
                {!isLoading && error && (
                  <tr>
                    <td className="screen-table__empty" colSpan={6}>
                      {error}
                    </td>
                  </tr>
                )}
              
                {!isLoading &&
                  !error &&
                  visibleRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.name}</td>
                      <td>{request.email}</td>
                      <td>
                        <label className="visually-hidden" htmlFor={`rank-${request.id}`}>
                          Rank for {request.name}
                        </label>
                        <select
                          className="rank-select"
                          disabled={savingRankId === request.id || rankOptions.length === 0}
                          id={`rank-${request.id}`}
                          onChange={(event) => void changeRank(request, event.target.value)}
                          value={request.level}
                        >
                          {!request.level && <option value="">—</option>}
                          {rankOptions.map((rank) => (
                            <option key={rank} value={rank}>
                              {rank}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{request.course}</td>
                      <td>{request.time}</td>
                      <td
                        className={
                          request.status === 'Overdue' ? 'table-overdue' : undefined
                        }
                      >
                        {request.status}
                      </td>
                    </tr>
                  ))}
              
                {!isLoading && !error && visibleRequests.length === 0 && (
                  <tr>
                    <td className="screen-table__empty" colSpan={6}>
                      No sign-up requests match your search.
                    </td>
                  </tr>
                )}
              </tbody>
          </table>
        </div>
        <footer className="screen-table-footer">
          <span>
            Showing {firstVisible}–{lastVisible} of {filteredRequests.length}
          </span>
          <div className="pagination">
            <button
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </section>
  )
}
