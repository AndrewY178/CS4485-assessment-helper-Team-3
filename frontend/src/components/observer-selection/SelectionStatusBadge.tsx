import type { ObserverSelectionStatus } from '../../types/api'

const observerSelectionStatusLabels: Record<ObserverSelectionStatus, string> = {
  'not-generated': 'Not generated',
  'pending-review': 'Pending review',
  approved: 'Approved',
  'invitations-sent': 'Invitations sent',
  'no-eligible-observers': 'No eligible observers',
}

export default function SelectionStatusBadge({ status }: { status: ObserverSelectionStatus }) {
  return (
    <span className={`observer-selection-status observer-selection-status--${status}`}>
      {observerSelectionStatusLabels[status]}
    </span>
  )
}
