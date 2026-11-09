import type { ObserveeStatus } from '../../types/api'

const observeeStatusLabels: Record<ObserveeStatus, string> = {
  not_generated: 'Not generated',
  generated: 'Pending review',
  approved: 'Approved',
  invitations_sent: 'Invitations sent',
  no_observers: 'No eligible observers',
  manual: 'Manually added'
}

export default function SelectionStatusBadge({ status }: { status: ObserveeStatus }) {
  return (
    <span className={`observer-selection-status observer-selection-status--${status}`}>
      {observeeStatusLabels[status]}
    </span>
  )
}
