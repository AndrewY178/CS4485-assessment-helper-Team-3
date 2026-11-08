import type { ObserverSelectionResponse, ObserveeStatus } from '../../types/api'

const summaryItems: Array<{ status?: ObserveeStatus; label: string }> = [
  { label: 'Faculty signed up' },
  { status: 'not_generated', label: 'Not generated' },
  { status: 'generated', label: 'Pending review' },
  { status: 'approved', label: 'Approved' },
  { status: 'no_observers', label: 'Unmatched' },
]

export default function SelectionSummary({ rows }: { rows: ObserverSelectionResponse[] }) {
  return (
    <section aria-label="Observer selection summary" className="observer-selection-summary">
      {summaryItems.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.status ? rows.filter((row) => row.status === item.status).length : rows.length}</strong>
        </div>
      ))}
    </section>
  )
}
