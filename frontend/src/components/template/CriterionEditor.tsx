import { useState, type FormEvent } from 'react'
import type { QuestionType, TemplateCriterion } from '../../types/template'

export type CriterionInput = Omit<TemplateCriterion, 'id' | 'position'>

interface CriterionEditorProps {
  criterion?: TemplateCriterion
  existingNames: string[]
  onCancel: () => void
  onSave: (input: CriterionInput) => void
}

interface EditorErrors {
  name?: string
  description?: string
  weight?: string
}

const questionTypes: QuestionType[] = [
  'Rating 1–5',
  'Yes/No',
  'Short Answer',
  'Long Answer',
]

export default function CriterionEditor({ criterion, existingNames, onCancel, onSave }: CriterionEditorProps) {
  const [name, setName] = useState(criterion?.name ?? '')
  const [description, setDescription] = useState(criterion?.description ?? '')
  const [type, setType] = useState<QuestionType>(criterion?.type ?? 'Rating 1–5')
  const [weight, setWeight] = useState(String(criterion?.weight ?? 1))
  const [required, setRequired] = useState(criterion?.required ?? true)
  const [errors, setErrors] = useState<EditorErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedWeight = Number(weight)
    const nextErrors: EditorErrors = {}

    if (!name.trim()) {
      nextErrors.name = 'Enter a criterion name.'
    } else if (existingNames.some((existingName) => existingName.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
      nextErrors.name = 'Criterion names must be unique.'
    }
    if (!description.trim()) nextErrors.description = 'Enter a criterion description.'
    if (type === 'Rating 1–5' && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      nextErrors.weight = 'Weight must be a number greater than 0.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSave({
      name: name.trim(),
      description: description.trim(),
      type,
      weight: type === 'Rating 1–5' ? parsedWeight : null,
      required,
    })
  }

  return (
    <form className="criterion-editor" noValidate onSubmit={handleSubmit}>
      <div className="criterion-editor__wide">
        <label htmlFor="criterion-name">Criterion name</label>
        <input
          aria-describedby={errors.name ? 'criterion-name-error' : undefined}
          aria-invalid={Boolean(errors.name)}
          autoFocus
          id="criterion-name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        {errors.name && <span className="template-field-error" id="criterion-name-error">{errors.name}</span>}
      </div>
      <div className="criterion-editor__wide">
        <label htmlFor="criterion-description">Description</label>
        <textarea
          aria-describedby={errors.description ? 'criterion-description-error' : undefined}
          aria-invalid={Boolean(errors.description)}
          id="criterion-description"
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          value={description}
        />
        {errors.description && <span className="template-field-error" id="criterion-description-error">{errors.description}</span>}
      </div>
      <div>
        <label htmlFor="criterion-type">Type</label>
        <select
          id="criterion-type"
          onChange={(event) => setType(event.target.value as QuestionType)}
          value={type}
        >
          {questionTypes.map((questionType) => (
            <option key={questionType} value={questionType}>{questionType}</option>
          ))}
        </select>
      </div>
      {type === 'Rating 1–5' && (
        <div>
          <label htmlFor="criterion-weight">Weight</label>
          <input
            aria-describedby={errors.weight ? 'criterion-weight-error' : undefined}
            aria-invalid={Boolean(errors.weight)}
            id="criterion-weight"
            inputMode="decimal"
            min="0"
            onChange={(event) => setWeight(event.target.value)}
            step="any"
            type="number"
            value={weight}
          />
          {errors.weight && <span className="template-field-error" id="criterion-weight-error">{errors.weight}</span>}
        </div>
      )}
      <div>
        <label htmlFor="criterion-required">Required</label>
        <select
          id="criterion-required"
          onChange={(event) => setRequired(event.target.value === 'yes')}
          value={required ? 'yes' : 'no'}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div className="criterion-editor__actions">
        <button className="template-button template-button--secondary" onClick={onCancel} type="button">Cancel</button>
        <button className="template-button template-button--primary" type="submit">
          {criterion ? 'Update criterion' : 'Add criterion'}
        </button>
      </div>
    </form>
  )
}
