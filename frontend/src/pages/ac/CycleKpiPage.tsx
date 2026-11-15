import { useEffect, useState } from 'react'
import { ApiError } from '../../api/auth'
import { getFeedbackBreakdown } from '../../api/feedback'
import { getKpis } from '../../api/kpis'
import { useAuth } from '../../context/AuthContext'
import type { CycleKpis, FeedbackBreakdownResponse } from '../../types/api'

function percent(rate: number | null): string {
  if (rate == null) return '—'
  return `${Math.round(rate * 100)}%`
}

function average(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(1)
}

function rankLabel(rank: string): string {
  if (rank === 'Assistant') return 'Assistant professor'
  if (rank === 'Associate') return 'Associate professor'
  if (rank === 'Full') return 'Professor'
  return rank
}

export default function CycleKpiPage() {
  const { token } = useAuth()
  const [cycles, setCycles] = useState<CycleKpis[]>([])
  const [selectedCycle, setSelectedCycle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [breakdown, setBreakdown] = useState<FeedbackBreakdownResponse | null>(null)
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [surveyError, setSurveyError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setError('Your session is unavailable. Please sign in again.')
      return
    }

    const controller = new AbortController()
    getKpis(token, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setCycles(response.cycles)
        setSelectedCycle(response.cycles[0]?.cycle ?? '')
        setError(null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setCycles([])
        setError(caught instanceof ApiError ? caught.message : 'Unable to load KPIs.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [token])

  useEffect(() => {
    if (!token || !selectedCycle) return
    const controller = new AbortController()
    setSurveyLoading(true)
    setSurveyError(null)
    getFeedbackBreakdown(selectedCycle, token, controller.signal)
      .then((stored) => {
        if (!controller.signal.aborted) setBreakdown(stored)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setBreakdown(null)
        setSurveyError(caught instanceof Error ? caught.message : 'Survey responses could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setSurveyLoading(false)
      })
    return () => controller.abort()
  }, [selectedCycle, token])

  const selectedIndex = cycles.findIndex((cycle) => cycle.cycle === selectedCycle)
  const current = selectedIndex >= 0 ? cycles[selectedIndex] : cycles[0]
  const previous = current ? cycles[selectedIndex + 1] : undefined
  const counts = breakdown && breakdown.semester === current?.cycle ? breakdown.counts : null
  const responseCount = counts ? counts.yes + counts.mostly + counts.no : 0
  const surveySummary = !current || surveyLoading
    ? 'Loading survey responses…'
    : surveyError
      ? surveyError
      : responseCount === 0
        ? 'No survey responses are stored for this semester.'
        : `${counts?.yes ?? 0} said the process was OK. ${counts?.mostly ?? 0} said mostly. ${counts?.no ?? 0} said no.`

  function row(metric: string, currentValue: string, previousValue: string, method: string) {
    return { metric, currentValue, previousValue, method }
  }

  const rows = current
    ? [
        row(
          'Eligibility accuracy',
          percent(current.eligibility.rate),
          percent(previous?.eligibility.rate ?? null),
          'Observer matches that are a different professor, the same level, the same department, and free at that time',
        ),
        row(
          'Same professor',
          String(current.eligibility.sameProfessor),
          previous ? String(previous.eligibility.sameProfessor) : '—',
          'Matches where the observer is the professor being observed',
        ),
        row(
          'Same level, other department',
          String(current.eligibility.otherDepartment),
          previous ? String(previous.eligibility.otherDepartment) : '—',
          'Matches at the right level whose course prefix is a different department',
        ),
        row(
          'Different level',
          String(current.eligibility.differentLevel),
          previous ? String(previous.eligibility.differentLevel) : '—',
          'Matches who do not teach the same level, in this department or any other',
        ),
        row(
          'Schedule conflicts',
          String(current.eligibility.scheduleConflict),
          previous ? String(previous.eligibility.scheduleConflict) : '—',
          'Matches who already teach at the same time',
        ),
        row(
          'Overdue evaluations',
          String(current.overdue),
          previous ? String(previous.overdue) : '—',
          'Professors with an earlier sign-up that still has no observation report',
        ),
        row(
          'Participation rate',
          percent(current.participationRate),
          percent(previous?.participationRate ?? null),
          'Professors who signed up divided by professors due this cycle',
        ),
        row(
          'Observer utilization',
          percent(current.observerUtilization.rate),
          percent(previous?.observerUtilization.rate ?? null),
          'Professors who observed divided by professors who signed up this cycle',
        ),
        row(
          'List sufficiency',
          average(current.listSufficiency.average),
          average(previous?.listSufficiency.average ?? null),
          'Average number of observer matches divided by the number of sign-ups',
        ),
        row(
          'Missing observations',
          String(current.missingObservations),
          previous ? String(previous.missingObservations) : '—',
          'Observation reports still outstanding, or observations that did not go through',
        ),
        row(
          'Survey completion',
          percent(current.survey.rate),
          percent(previous?.survey.rate ?? null),
          'Professors who signed up, sent a request, were observed, and submitted the final survey',
        ),
      ]
    : []

  return (
    <section className="screen-page kpi-page">
      <header className="screen-header kpi-header">
        <div>
          <p className="screen-eyebrow">{current ? `${current.cycle} · Assessment Committee` : 'Assessment Committee'}</p>
          <h1>Cycle KPI report</h1>
          <p>Review cycle progress and compare key measures with the previous semester.</p>
        </div>
        <label className="kpi-cycle-select">
          <span>Reporting cycle</span>
          <select
            aria-label="Reporting cycle"
            onChange={(event) => setSelectedCycle(event.target.value)}
            value={current?.cycle ?? ''}
          >
            {cycles.map((cycle) => (
              <option key={cycle.cycle}>{cycle.cycle}</option>
            ))}
          </select>
        </label>
      </header>

      {isLoading && <p>Loading KPI report...</p>}
      {error && <p role="alert">{error}</p>}

      {current && (
        <>
          <section aria-label="Current cycle indicators" className="kpi-highlights">
            <article className="kpi-highlight">
              <p>Participation rate</p>
              <strong>{percent(current.participationRate)}</strong>
              <span>{current.signedUp} of {current.due} professors due signed up</span>
            </article>
            <article className="kpi-highlight">
              <p>Observer utilization</p>
              <strong>{percent(current.observerUtilization.rate)}</strong>
              <span>{current.observerUtilization.observed} of {current.observerUtilization.signedUp} signed-up professors observed a class</span>
            </article>
            <article className="kpi-highlight">
              <p>List sufficiency</p>
              <strong>{average(current.listSufficiency.average)}</strong>
              <span>{current.listSufficiency.matches} matches across {current.listSufficiency.signups} sign-ups</span>
            </article>
            <article className="kpi-highlight">
              <p>Survey completion</p>
              <strong>{percent(current.survey.rate)}</strong>
              <span>
                {current.survey.completed} of {current.survey.reachedSurvey} observed professors submitted a survey
              </span>
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
                      <th scope="col">{current.cycle}</th>
                      <th scope="col">{previous?.cycle ?? 'Previous cycle'}</th>
                      <th scope="col">How it&apos;s measured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.metric}>
                        <th scope="row">{item.metric}</th>
                        <td>{item.currentValue}</td>
                        <td>{item.previousValue}</td>
                        <td className="kpi-method">{item.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="kpi-side">
              <section aria-labelledby="hire-level-title" className="kpi-side-card">
                <h2 id="hire-level-title">Participation by hire level</h2>
                {current.byRank.map((rank) => (
                  <div className="hire-level-bar" key={rank.rank}>
                    <div className="hire-level-bar__heading">
                      <span>{rankLabel(rank.rank)}</span>
                      <strong>{percent(rank.rate)}</strong>
                    </div>
                    <div
                      aria-label={`${percent(rank.rate)} participation`}
                      className="hire-level-bar__track"
                    >
                      <span style={{ width: `${Math.round((rank.rate ?? 0) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </section>

              <section aria-labelledby="survey-feedback-title" className="kpi-side-card survey-feedback">
                <h2 id="survey-feedback-title">Survey feedback</h2>
                <p role={surveyError ? 'alert' : undefined}>{surveySummary}</p>
              </section>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
