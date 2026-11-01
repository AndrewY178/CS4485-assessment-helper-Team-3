import { useEffect, useRef } from 'react'

interface ConfirmDeadlineChangeDialogProps {
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDeadlineChangeDialog({
  onCancel,
  onConfirm,
}: ConfirmDeadlineChangeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      aria-labelledby="deadline-confirm-title"
      className="cycle-dialog"
      onCancel={onCancel}
      ref={dialogRef}
    >
      <h2 id="deadline-confirm-title">Save deadline changes?</h2>
      <p>
        Faculty activity already exists for this cycle. Changing a deadline may
        affect sign-ups, observations, or scheduled notifications.
      </p>
      <div className="cycle-dialog__actions">
        <button className="cycle-button cycle-button--secondary" onClick={onCancel} type="button">Keep editing</button>
        <button className="cycle-button cycle-button--primary" onClick={onConfirm} type="button">Save changes</button>
      </div>
    </dialog>
  )
}

