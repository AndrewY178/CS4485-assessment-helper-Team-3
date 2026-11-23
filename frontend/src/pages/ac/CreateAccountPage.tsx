import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { ApiError } from '../../api/auth'
import { updateProfessorRank } from '../../api/professorRank'
import { createAccount, getUsers } from '../../api/users'
import { useAuth } from '../../context/AuthContext'
import type { UserResponse } from '../../types/api'

const pageSize = 8

export default function CreateAccountPage() {
  const { token } = useAuth()
  const [professors, setProfessors] = useState<UserResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [rank, setRank] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [savingRankId, setSavingRankId] = useState<string | null>(null)

  async function loadProfessors(signal?: AbortSignal) {
    setProfessors(await getUsers(signal, token ?? undefined))
  }

  useEffect(() => {
    const controller = new AbortController()
    getUsers(controller.signal, token ?? undefined)
      .then(setProfessors)
      .catch((loadError) => {
        if (controller.signal.aborted) return
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : 'Unable to load professors.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [token])

  const rankOptions = useMemo(
    () =>
      [...new Set(professors.map((p) => p.prof_rank).filter((r): r is string => !!r))].sort(),
    [professors],
  )
  const departmentOptions = useMemo(
    () =>
      [...new Set(professors.map((p) => p.department).filter((d): d is string => !!d))].sort(),
    [professors],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return professors.filter(
      (p) =>
        !query ||
        `${p.name} ${p.username} ${p.email ?? ''} ${p.department ?? ''}`.toLowerCase().includes(query),
    )
  }, [professors, search])

  const pageCount = Math.ceil(filtered.length / pageSize)
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const firstVisible = filtered.length ? page * pageSize + 1 : 0
  const lastVisible = Math.min((page + 1) * pageSize, filtered.length)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    setNotice('')
    if (!token) {
      setFormError('Your session is unavailable. Please sign in again.')
      return
    }
    setIsCreating(true)
    try {
      const created = await createAccount(
        {
          name: name.trim(),
          email: email.trim(),
          department: department || undefined,
          prof_rank: rank || undefined,
        },
        token,
      )
      // The setup email is a placeholder on the backend (Mekha). Until it is
      // implemented, the professor will not receive a link automatically.
      setNotice(`Account created for ${created.name}. The setup email has not been implemented yet.`)
      setName('')
      setEmail('')
      setDepartment('')
      setRank('')
      await loadProfessors()
    } catch (createError) {
      setFormError(
        createError instanceof ApiError
          ? createError.message
          : 'Unable to create this account.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function changeRank(professor: UserResponse, profRank: string) {
    if (!profRank || profRank === professor.prof_rank) return
    if (!token) {
      setFormError('Your session is unavailable. Please sign in again.')
      return
    }
    setFormError('')
    setNotice('')
    setSavingRankId(professor.id)
    try {
      const updated = await updateProfessorRank(professor.id, profRank, token)
      setProfessors((current) =>
        current.map((p) =>
          p.id === professor.id ? { ...p, prof_rank: updated.prof_rank } : p,
        ),
      )
      setNotice(`${professor.name} is now ${updated.prof_rank}.`)
    } catch (saveError) {
      setFormError(
        saveError instanceof ApiError
          ? saveError.message
          : 'Unable to update this professor rank.',
      )
    } finally {
      setSavingRankId(null)
    }
  }

  return (
    <section className="screen-page signups-page">
      <header className="screen-header signups-header">
        <div>
          <h1>Create account</h1>
          <p>
            {professors.length
              ? `${professors.length} professors on file. Add a new professor below.`
              : 'No professors on file yet.'}
          </p>
        </div>
        <div className="screen-controls">
          <label className="search-field">
            <Search aria-hidden="true" className="search-field__icon" />
            <span className="visually-hidden">Search by name, email, or department</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
              placeholder="Search by name, email or department"
              type="search"
              value={search}
            />
          </label>
        </div>
      </header>

      <form className="create-account-form" onSubmit={handleCreate}>
        <label>
          Name
          <input
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </label>
        <label>
          Email
          <input
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Department
          <select onChange={(event) => setDepartment(event.target.value)} value={department}>
            <option value="">—</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rank
          <select onChange={(event) => setRank(event.target.value)} value={rank}>
            <option value="">—</option>
            {rankOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button disabled={isCreating} type="submit">
          {isCreating ? 'Creating...' : 'Create account'}
        </button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {formError && <p className="form-error" role="alert">{formError}</p>}

      <div className="screen-table-card">
        <div className="screen-table-scroll">
          <table className="screen-table signups-table">
            <thead>
              <tr>
                <th scope="col">Professor</th>
                <th scope="col">Email</th>
                <th scope="col">Department</th>
                <th scope="col">Rank</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="screen-table__empty" colSpan={5}>Loading professors...</td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td className="screen-table__empty" colSpan={5}>{error}</td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                visible.map((professor) => (
                  <tr key={professor.id}>
                    <td>{professor.name}</td>
                    <td>{professor.email || professor.username}</td>
                    <td>{professor.department || '—'}</td>
                    <td>
                      <label className="visually-hidden" htmlFor={`rank-${professor.id}`}>
                        Rank for {professor.name}
                      </label>
                      <select
                        className="rank-select"
                        disabled={savingRankId === professor.id || rankOptions.length === 0}
                        id={`rank-${professor.id}`}
                        onChange={(event) => void changeRank(professor, event.target.value)}
                        value={professor.prof_rank ?? ''}
                      >
                        {!professor.prof_rank && <option value="">—</option>}
                        {rankOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{professor.is_ac_member ? 'AC Member' : 'Faculty'}</td>
                  </tr>
                ))}
              {!isLoading && !error && visible.length === 0 && (
                <tr>
                  <td className="screen-table__empty" colSpan={5}>
                    No professors match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="screen-table-footer">
          <span>
            Showing {firstVisible}–{lastVisible} of {filtered.length}
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
