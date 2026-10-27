import type { ObserverSelectionResponse } from '../../types/api'
import SelectionStatusBadge from './SelectionStatusBadge'

interface ObserveeSelectionTableProps {
  rows: ObserverSelectionResponse[]
  selectedId: string
  onReview: (observationId: string) => void
}

export default function ObserveeSelectionTable({
  rows,
  selectedId,
  onReview,
}: ObserveeSelectionTableProps) {
  return (
    <div className="observer-selection-table-wrap">
      <table className="observer-selection-table">
        <thead>
          <tr>
            <th scope="col">Observee</th>
            <th scope="col">Course / section</th>
            <th scope="col">Meeting time</th>
            <th scope="col">Matches</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="observer-selection-sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.observationId === selectedId ? 'is-selected' : ''} key={row.observationId}>
              <td>
                <strong>{row.observee.name}</strong>
                <span>{row.observee.department}</span>
              </td>
              <td>
                <strong>{row.course.code}-{row.course.section}</strong>
                <span>{row.course.title}</span>
              </td>
              <td>
                {row.course.meetingDays.join('/')}<br />
                {row.course.startTime}–{row.course.endTime}
              </td>
              <td>{row.recommendations.length} of 5</td>
              <td><SelectionStatusBadge status={row.status} /></td>
              <td>
                <button
                  aria-label={`Review ${row.observee.name}`}
                  className="observer-selection-link"
                  onClick={() => onReview(row.observationId)}
                  type="button"
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
