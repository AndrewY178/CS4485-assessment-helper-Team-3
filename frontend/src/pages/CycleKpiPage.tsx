import { useState } from 'react'

const kpis = [
  { metric: 'Eligibility accuracy', fall: '100%', spring: '93%', method: 'Eligible faculty with a correct cycle assignment' },
  { metric: 'Overdue evaluations', fall: '6', spring: '9', method: 'Evaluations still incomplete after the deadline' },
  { metric: 'Participation rate', fall: '60%', spring: '75%', method: 'Completed observations divided by evaluations due' },
  { metric: 'Observer utilization', fall: '83%', spring: '58%', method: 'Assigned observations divided by observer capacity' },
  { metric: 'Missing observations', fall: '1', spring: '3', method: 'Faculty due without a completed observation' },
]

export default function CycleKpiPage() {
  const [notice, setNotice] = useState('')

  return (
    <section className="screen-page kpi-page">
      <header className="screen-header kpi-header">
        <div>
          <p className="screen-eyebrow">Fall 2026 · Assessment Committee</p>
          <h1>Cycle KPI report</h1>
          <p>Review cycle progress and compare key measures with the previous semester.</p>
        </div>
        <label className="kpi-cycle-select">
          <span>Reporting cycle</span>
          <select aria-label="Reporting cycle" defaultValue="Fall 2026">
            <option>Fall 2026</option>
            <option>Spring 2027</option>
          </select>
        </label>
      </header>

      <section aria-label="Current cycle indicators" className="kpi-highlights">
        <article className="kpi-highlight">
          <p>Participation rate</p>
          <strong>60%</strong>
          <span>15 of 25 observations complete</span>
        </article>
        <article className="kpi-highlight">
          <p>Observer utilization</p>
          <strong>83%</strong>
          <span>10 of 12 observer slots assigned</span>
        </article>
        <article className="kpi-highlight">
          <p>List sufficiency</p>
          <strong>92%</strong>
          <span>23 of 25 faculty have an observer</span>
        </article>
        <article className="kpi-highlight">
          <p>Survey completion</p>
          <strong>75%</strong>
          <span>18 of 24 responses received</span>
        </article>
      </section>

      <div className="kpi-content">
        <section aria-labelledby="kpi-table-title" className="kpi-table-section">
          <h2 className="section-heading" id="kpi-table-title">Cycle KPIs</h2>
          <div className="kpi-table-scroll">
            <table className="screen-table kpi-table">
              <thead>
                <tr>
                  <th scope="col">KPI</th>
                  <th scope="col">Fall 2026</th>
                  <th scope="col">Spring 2027</th>
                  <th scope="col">How it&apos;s measured</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((row) => (
                  <tr key={row.metric}>
                    <th scope="row">{row.metric}</th>
                    <td>{row.fall}</td>
                    <td>{row.spring}</td>
                    <td className="kpi-method">{row.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="kpi-side">
          <section aria-labelledby="hire-level-title" className="kpi-side-card">
            <h2 id="hire-level-title">Participation by hire level</h2>
            <div className="hire-level-bar">
              <div className="hire-level-bar__heading"><span>Professor</span><strong>88%</strong></div>
              <div aria-label="88 percent participation" className="hire-level-bar__track">
                <span />
              </div>
            </div>
            <div className="hire-level-bar">
              <div className="hire-level-bar__heading"><span>Associate professor</span><strong>67%</strong></div>
              <div aria-label="67 percent participation" className="hire-level-bar__track">
                <span className="hire-level-bar__fill--mid" />
              </div>
            </div>
            <div className="hire-level-bar">
              <div className="hire-level-bar__heading"><span>Assistant professor</span><strong>50%</strong></div>
              <div aria-label="50 percent participation" className="hire-level-bar__track">
                <span className="hire-level-bar__fill--low" />
              </div>
            </div>
          </section>

          <section aria-labelledby="survey-feedback-title" className="kpi-side-card survey-feedback">
            <h2 id="survey-feedback-title">Survey feedback</h2>
            <p>17 of 20 said the process was OK<br />3 uploaded files about problems<br />Top issue: scheduling conflicts</p>
            <button
              className="text-link kpi-feedback-link"
              onClick={() => setNotice('Survey responses: 17 faculty said the process was OK. Common themes were scheduling conflicts, clear instructions, and observer availability.')}
              type="button"
            >
              Read all responses
            </button>
          </section>
        </aside>
      </div>

      {notice && (
        <div className="kpi-feedback-dialog" role="dialog" aria-modal="true" aria-label="Survey responses">
          <div className="kpi-feedback-dialog__card">
            <button
              aria-label="Close survey responses"
              className="kpi-feedback-dialog__close"
              onClick={() => setNotice('')}
              type="button"
            >
              ×
            </button>
            <h2>Survey responses</h2>
            <p>{notice.replace('Survey responses: ', '')}</p>
          </div>
        </div>
      )}
    </section>
  )
}
