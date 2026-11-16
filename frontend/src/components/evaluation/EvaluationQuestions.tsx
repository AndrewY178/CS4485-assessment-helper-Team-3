import type { EvaluationQuestion, EvaluationValue } from '../../types/evaluation'

interface EvaluationQuestionsProps {
  questions: EvaluationQuestion[]
  answers: Record<string, EvaluationValue>
  editable: boolean
  onChange?: (questionId: string, value: EvaluationValue | '') => void
}

export default function EvaluationQuestions({ questions, answers, editable, onChange }: EvaluationQuestionsProps) {
  return (
    <div className="evaluation-questions">
      {questions.map((question) => {
        const id = String(question.id)
        const value = answers[id] ?? ''
        return (
          <section className="evaluation-question" key={question.id}>
            <h3>{question.position}. {question.name}{question.required ? ' *' : ''}</h3>
            {question.description && <p>{question.description}</p>}
            {question.type === 'rating' && (
              <fieldset className="evaluation-choice-group">
                <legend className="visually-hidden">Rating for {question.name}</legend>
                <div className="request-date-options">
                  {[
                    { value: 1, label: '1 — Poor' },
                    { value: 2, label: '2 — Below Expectations' },
                    { value: 3, label: '3 — Meets Expectations' },
                    { value: 4, label: '4 — Exceeds Expectations' },
                    { value: 5, label: '5 — Excellent' },
                    { value: 'N/A', label: 'N/A' },
                  ].map((option) => (
                    <label className={`date-option${value === option.value ? ' date-option--selected' : ''}`} key={option.value}>
                      <input
                        checked={value === option.value}
                        disabled={!editable}
                        name={`evaluation-answer-${id}`}
                        onChange={() => onChange?.(id, option.value)}
                        type="radio"
                        value={option.value}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {question.type === 'yes_no' && (
              <fieldset className="evaluation-choice-group">
                <legend className="visually-hidden">Answer for {question.name}</legend>
                <div className="request-date-options">
                  {[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ].map((option) => (
                    <label className={`date-option${value === option.value ? ' date-option--selected' : ''}`} key={option.value}>
                      <input
                        checked={value === option.value}
                        disabled={!editable}
                        name={`evaluation-answer-${id}`}
                        onChange={() => onChange?.(id, option.value)}
                        type="radio"
                        value={option.value}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {question.type === 'short_answer' && (
              <label>
                <span className="visually-hidden">{question.name}</span>
                <input disabled={!editable} maxLength={10000} onChange={(event) => onChange?.(id, event.target.value)} type="text" value={String(value)} />
              </label>
            )}
            {question.type === 'long_answer' && (
              <label>
                <span className="visually-hidden">{question.name}</span>
                <textarea disabled={!editable} maxLength={10000} onChange={(event) => onChange?.(id, event.target.value)} rows={4} value={String(value)} />
              </label>
            )}
          </section>
        )
      })}
      {questions.length === 0 && <p>No questions are available in this evaluation template.</p>}
    </div>
  )
}
