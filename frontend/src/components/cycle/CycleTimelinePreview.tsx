import type { CycleStatus } from '../../types/api'

interface TimelineDeadline {
  label: string
  value: string
}

interface CycleTimelinePreviewProps {
  deadlines: TimelineDeadline[]
  status: CycleStatus
}

function formatDate(value: string) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function CycleTimelinePreview({ deadlines, status }: CycleTimelinePreviewProps) {
  return (
    <section aria-labelledby="cycle-timeline-title" className="cycle-timeline">
      <div className="cycle-section-heading">
        <h2 id="cycle-timeline-title">Cycle timeline</h2>
        <span className={`cycle-status cycle-status--${status}`}>{status}</span>
      </div>
      <ol>
        {deadlines.map((deadline, index) => (
          <li key={deadline.label}>
            <span className="cycle-timeline__number">{index + 1}</span>
            <div>
              <strong>{deadline.label}</strong>
              <span>{formatDate(deadline.value)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

