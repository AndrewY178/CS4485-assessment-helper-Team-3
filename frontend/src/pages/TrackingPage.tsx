import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

type ObservationStage =
  | 'Waiting on observer'
  | 'Scheduled'
  | 'Awaiting signatures'
  | 'Signed'
  | "Couldn't happen"
  | 'No eligible observer'

interface Observation {
  observee: string
  course: string
  observer: string
  date: string
  stage: ObservationStage
}

const observations: Observation[] = [
  { observee: 'Dr. Priya Raman', course: 'CS 1337.002', observer: 'Dr. L. Ortiz', date: 'Nov 5', stage: 'Scheduled' },
  { observee: 'Dr. Daniel Ruiz', course: 'CS 3345.001', observer: '—', date: '—', stage: 'Waiting on observer' },
  { observee: 'Dr. Sam Okafor', course: 'CS 3354.002', observer: 'Dr. T. Kim', date: 'Oct 30', stage: 'Awaiting signatures' },
  { observee: 'Dr. Lena Fischer', course: 'CS 2340.004', observer: 'Dr. R. Shah', date: 'Oct 29', stage: 'Signed' },
  { observee: 'Dr. Omar Haddad', course: 'CS 6360.501', observer: 'Dr. E. Wallace', date: 'Nov 3', stage: "Couldn't happen" },
  { observee: 'Dr. Maya Chen', course: 'CS 4349.003', observer: '—', date: '—', stage: 'No eligible observer' },
  { observee: 'Dr. Kim Tran', course: 'CS 3341.003', observer: 'Dr. A. Patel', date: 'Nov 7', stage: 'Scheduled' },
  { observee: 'Dr. Ravi Menon', course: 'CS 2336.004', observer: '—', date: '—', stage: 'Waiting on observer' },
  { observee: 'Dr. Elena Petrova', course: 'CS 4341.001', observer: 'Dr. N. Williams', date: 'Oct 31', stage: 'Awaiting signatures' },
  { observee: 'Dr. Marcus Bell', course: 'CS 4384.002', observer: 'Dr. S. Alvarez', date: 'Oct 28', stage: 'Signed' },
  { observee: 'Dr. Aisha Patel', course: 'CS 3377.001', observer: 'Dr. M. Bell', date: 'Oct 27', stage: 'Signed' },
  { observee: 'Dr. Noah Williams', course: 'CS 4390.003', observer: '—', date: '—', stage: 'Waiting on observer' },
]

const summary = [
  { label: 'Waiting on observer', value: '3' },
  { label: 'Scheduled', value: '2' },
  { label: 'Awaiting signatures', value: '2' },
  { label: 'Signed', value: '3' },
  { label: 'Needs attention', value: '2', warning: true },
]

function stageClass(stage: ObservationStage) {
  return stage === "Couldn't happen" || stage === 'No eligible observer'
    ? 'observation-stage observation-stage--warning'
    : 'observation-stage'
}

export default function TrackingPage() {
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')

  const filteredObservations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return observations
    return observations.filter((observation) =>
      `${observation.observee} ${observation.course} ${observation.observer}`
        .toLowerCase()
        .includes(query),
    )
  }, [search])

  function sendSurvey() {
    setNotice('The end-of-process survey is ready to send.')
    window.setTimeout(() => setNotice(''), 3200)
  }

  return (
    <section className="screen-page tracking-page">
      <header className="screen-header tracking-header">
        <div>
          <h1>Observation tracking</h1>
          <p>3 of 12 signed · 14 days left until Nov 21</p>
        </div>
        <button className="button button--primary" onClick={sendSurvey} type="button">
          Send end-of-process survey
        </button>
      </header>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      <section aria-label="Observation status summary" className="tracking-summary">
        {summary.map(({ label, value, warning }) => (
          <div
            className={`tracking-summary__item${warning ? ' tracking-summary__item--warning' : ''}`}
            key={label}
          >
            <p>{label}</p>
            <span>{value}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="observations-heading" className="observations-section">
        <h2 id="observations-heading">All observations</h2>
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
                <tr key={observation.observee}>
                  <td>{observation.observee}</td>
                  <td>{observation.course}</td>
                  <td>{observation.observer}</td>
                  <td>{observation.date}</td>
                  <td className={stageClass(observation.stage)}>
                    {observation.stage}
                  </td>
                </tr>
              ))}
              {filteredObservations.length === 0 && (
                <tr>
                  <td className="screen-table__empty" colSpan={5}>
                    No observations match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
