import type { ObserverSelectionResponse, ObserverSelectionStatus } from '../../types/api'

const summaryItems: Array<{ status?: ObserverSelectionStatus; label: string }> = [
  { label: 'Faculty signed up' },
  { status: 'not-generated', label: 'Not generated' },
  { status: 'pending-review', label: 'Pending review' },
  { status: 'approved', label: 'Approved' },
  { status: 'no-eligible-observers', label: 'Unmatched' },
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
