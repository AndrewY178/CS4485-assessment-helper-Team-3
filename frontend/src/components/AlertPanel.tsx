import { AppLink } from '../context/NavigationContext'
import type { DashboardAlert } from '../types/api'
import { AlertTriangleIcon } from './Icons'

function formatTime(time: string | null): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function formatAlert(alert: DashboardAlert): string {
  const start = formatTime(alert.courseStartTime)
  const end = formatTime(alert.courseEndTime)
  const time = start && end ? `${start}–${end}` : ''
  const schedule = [alert.courseDay, time].filter(Boolean).join(' ')
  return [alert.professorName, alert.course, schedule].filter(Boolean).join(' · ')
}

export default function AlertPanel({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <aside aria-label="Observation notes" className="alert-panels">
      <section className="alert-panel" aria-labelledby="eligible-observers">
        <h2 className="alert-panel__title" id="eligible-observers">
          <AlertTriangleIcon className="alert-panel__icon" />
          No eligible observers
        </h2>
        {alerts.length === 0 && <p>Every sign-up has an observer match.</p>}
        {alerts.map((alert) => (
          <p key={formatAlert(alert)}>{formatAlert(alert)}</p>
        ))}
        <AppLink className="text-link" to="/observer-selection">
          Review in observer selection
        </AppLink>
      </section>

      <section className="alert-panel" aria-labelledby="template-title">
        <h2 className="alert-panel__title" id="template-title">
          Observation template
        </h2>
        <p>
          8 criteria · 1–5 rating scale. Only AC members can edit. Signed
          observations never change.
        </p>
        <AppLink className="text-link" to="/template">
          Edit template
        </AppLink>
      </section>
    </aside>
  )
}
