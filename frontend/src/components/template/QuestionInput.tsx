import type { RatingOption, TemplateCriterion } from '../../types/template'

interface QuestionInputProps {
  criterion: TemplateCriterion
  ratingScale: RatingOption[]
}

export default function QuestionInput({ criterion, ratingScale }: QuestionInputProps) {
  const fieldName = `preview-${criterion.id}`
  const requirement = criterion.required ? 'required' : 'optional'

  if (criterion.type === 'Short Answer') {
    return (
      <label className="preview-text-field">
        <span>Response ({requirement})</span>
        <input disabled type="text" />
      </label>
    )
  }

  if (criterion.type === 'Long Answer') {
    return (
      <label className="preview-text-field">
        <span>Response ({requirement})</span>
        <textarea disabled rows={4} />
      </label>
    )
  }

  const options = criterion.type === 'Rating 1–5'
    ? ratingScale.map((option) => ({ key: String(option.value), label: `${option.value} — ${option.label}` }))
    : [
        { key: 'yes', label: 'Yes' },
        { key: 'no', label: 'No' },
      ]

  return (
    <fieldset>
      <legend>{criterion.type} ({requirement})</legend>
      <div className="preview-rating-options">
        {options.map((option) => (
          <label key={option.key}>
            <input disabled name={fieldName} type="radio" />
            <span>{option.label}</span>
          </label>
        ))}
        {criterion.type === 'Rating 1–5' && (
          <label>
            <input disabled name={fieldName} type="radio" />
            <span>N/A</span>
          </label>
        )}
      </div>
    </fieldset>
  )
}

