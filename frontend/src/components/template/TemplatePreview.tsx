import { useEffect, useRef } from 'react'
import type { ObservationTemplate } from '../../types/template'
import QuestionInput from './QuestionInput'

interface TemplatePreviewProps {
  template: ObservationTemplate
  label: string
  onClose: () => void
}

export default function TemplatePreview({ template, label, onClose }: TemplatePreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      aria-labelledby="preview-dialog-title"
      className="template-dialog template-preview"
      onCancel={onClose}
      ref={dialogRef}
    >
      <div className="template-preview__header">
        <div>
          <p className="template-eyebrow">{label}</p>
          <h2 id="preview-dialog-title">Observation form preview</h2>
        </div>
        <button aria-label="Close preview" className="template-dialog__close" onClick={onClose} type="button">
          ×
        </button>
      </div>

      {template.criteria.length === 0 ? (
        <p className="template-empty template-empty--preview">No criteria have been added yet.</p>
      ) : (
        <ol className="preview-criteria">
          {template.criteria.map((criterion) => (
            <li className="preview-criterion" key={criterion.id}>
              <h3>{criterion.name}</h3>
              <p>{criterion.description}</p>
              <QuestionInput criterion={criterion} ratingScale={template.ratingScale} />
            </li>
          ))}
        </ol>
      )}
    </dialog>
  )
}
