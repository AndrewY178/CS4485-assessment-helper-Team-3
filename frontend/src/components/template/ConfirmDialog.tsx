import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  criterionName: string
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  criterionName,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      aria-labelledby="delete-dialog-title"
      className="template-dialog template-dialog--small"
      onCancel={onCancel}
      ref={dialogRef}
    >
      <h2 id="delete-dialog-title">Remove criterion?</h2>
      <p>
        “{criterionName}” will be removed from this working draft. The current
        template and signed reports will not change.
      </p>
      <div className="template-dialog__actions">
        <button className="template-button template-button--secondary" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="template-button template-button--danger" onClick={onConfirm} type="button">
          Remove
        </button>
      </div>
    </dialog>
  )
}

