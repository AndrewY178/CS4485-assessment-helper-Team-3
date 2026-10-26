import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

type SignUpStatus = 'Due' | 'Overdue'

interface SignUpRequest {
  name: string
  email: string
  level: string
  course: string
  time: string
  status: SignUpStatus
}

const signUpRequests: SignUpRequest[] = [
  { name: 'Dr. Priya Raman', email: 'p.raman@utdallas.edu', level: 'Professor', course: 'CS 1337.002', time: 'MW 8:30', status: 'Due' },
  { name: 'Dr. Daniel Ruiz', email: 'd.ruiz@utdallas.edu', level: 'Professor', course: 'CS 3345.001', time: 'TR 1:00', status: 'Due' },
  { name: 'Dr. Maya Chen', email: 'm.chen@utdallas.edu', level: 'Professor', course: 'CS 4349.003', time: 'TR 10:00', status: 'Overdue' },
  { name: 'Dr. Omar Haddad', email: 'o.haddad@utdallas.edu', level: 'Professor', course: 'CS 6360.501', time: 'MW 4:00', status: 'Overdue' },
  { name: 'Dr. Lena Fischer', email: 'l.fischer@utdallas.edu', level: 'Professor', course: 'CS 2340.004', time: 'MW 11:30', status: 'Due' },
  { name: 'Dr. Sam Okafor', email: 's.okafor@utdallas.edu', level: 'Professor', course: 'CS 3354.002', time: 'TR 2:30', status: 'Due' },
  { name: 'Dr. Kim Tran', email: 'k.tran@utdallas.edu', level: 'Professor', course: 'CS 3341.003', time: 'MW 2:30', status: 'Due' },
  { name: 'Dr. Ravi Menon', email: 'r.menon@utdallas.edu', level: 'Professor', course: 'CS 2336.004', time: 'MW 1:00', status: 'Overdue' },
  { name: 'Dr. Elena Petrova', email: 'e.petrova@utdallas.edu', level: 'Professor', course: 'CS 4341.001', time: 'TR 11:30', status: 'Due' },
  { name: 'Dr. Marcus Bell', email: 'm.bell@utdallas.edu', level: 'Professor', course: 'CS 4384.002', time: 'MW 10:00', status: 'Due' },
  { name: 'Dr. Aisha Patel', email: 'a.patel@utdallas.edu', level: 'Professor', course: 'CS 3377.001', time: 'TR 9:30', status: 'Overdue' },
  { name: 'Dr. Noah Williams', email: 'n.williams@utdallas.edu', level: 'Professor', course: 'CS 4390.003', time: 'MW 3:00', status: 'Due' },
  { name: 'Dr. Sofia Alvarez', email: 's.alvarez@utdallas.edu', level: 'Professor', course: 'CS 4485.001', time: 'TR 4:00', status: 'Due' },
  { name: 'Dr. Ethan Brooks', email: 'e.brooks@utdallas.edu', level: 'Professor', course: 'CS 4301.002', time: 'MW 12:00', status: 'Overdue' },
]

const pageSize = 8

export default function SignUpsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'All statuses' | SignUpStatus>('All statuses')
  const [page, setPage] = useState(0)

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
  }, [search, status])

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
          <p>4 of 24 due or overdue faculty have signed up.</p>
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
              {visibleRequests.map((request) => (
                <tr key={request.email}>
                  <td>{request.name}</td>
                  <td>{request.email}</td>
                  <td>{request.level}</td>
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
              {visibleRequests.length === 0 && (
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
