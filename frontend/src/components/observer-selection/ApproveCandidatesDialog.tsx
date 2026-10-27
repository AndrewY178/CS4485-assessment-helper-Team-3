import { useEffect, useRef } from 'react'

interface ApproveCandidatesDialogProps {
  candidateCount: number
  observeeName: string
  onCancel: () => void
  onConfirm: () => void
}

export default function ApproveCandidatesDialog({
  candidateCount,
  observeeName,
  onCancel,
  onConfirm,
}: ApproveCandidatesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog className="observer-selection-dialog" onCancel={onCancel} ref={dialogRef}>
      <h2>Approve candidate list?</h2>
      <p>
        Approve {candidateCount} candidate{candidateCount === 1 ? '' : 's'} for {observeeName}?
        This makes the list available to the Observee but does not send invitations.
      </p>
      <div>
        <button className="observer-selection-button observer-selection-button--secondary" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="observer-selection-button observer-selection-button--primary" onClick={onConfirm} type="button">
          Approve list
        </button>
      </div>
    </dialog>
  )
}
