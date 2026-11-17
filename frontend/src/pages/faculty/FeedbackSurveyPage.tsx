import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/auth'
import { getFeedback, saveFeedback } from '../../api/feedback'
import { useAuth } from '../../context/AuthContext'
import { useCurrentSemester } from '../../hooks/useCurrentSemester'
import type {
  FeedbackProcessRating,
  FeedbackResponse,
  FeedbackSemesterRole,
  FeedbackSurveyContext,
  SaveFeedbackRequest,
} from '../../types/feedback'
import '../../styles/feedback-survey.css'

interface SurveyFormValues {
  semesterRole: FeedbackSemesterRole | ''
  processOk: FeedbackProcessRating | ''
  difficulties: string
  improvements: string
}

interface FeedbackSurveyFormProps {
  context: FeedbackSurveyContext
  professorId: string
  token: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; previouslySubmitted: boolean }
  | { status: 'error'; message: string }

const emptyForm: SurveyFormValues = {
  semesterRole: '',
  processOk: '',
  difficulties: '',
  improvements: '',
}

const semesterRoleOptions: Array<{
  label: string
  value: FeedbackSemesterRole
}> = [
  { label: 'Observed', value: 'observee' },
  { label: 'An observer', value: 'observer' },
  { label: 'Both', value: 'both' },
]

const processOptions: Array<{
  label: string
  value: FeedbackProcessRating
}> = [
  { label: 'Yes', value: 'yes' },
  { label: 'Mostly', value: 'mostly' },
  { label: 'No', value: 'no' },
]

function formatDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function responseToForm(response: FeedbackResponse): SurveyFormValues {
  return {
    semesterRole: response.semester_role,
    processOk: response.process_OK,
    difficulties: response.difficulties ?? '',
    improvements: response.improvements ?? '',
  }
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string
  name: string
  options: Array<{ label: string; value: T }>
  value: T | ''
  onChange: (value: T) => void
  error?: string
}) {
  const errorId = `${name}-error`

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? 'true' : undefined}
      className="feedback-choice-field"
    >
      <legend>{legend}</legend>
      <div className="feedback-choice-list">
        {options.map((option) => (
          <label className="feedback-choice" key={option.value}>
            <input
              checked={value === option.value}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <span className="feedback-field-error" id={errorId}>
          {error}
        </span>
      )}
    </fieldset>
  )
}

function FeedbackSurveyForm({
  context,
  professorId,
  token,
}: FeedbackSurveyFormProps) {
  const [form, setForm] = useState<SurveyFormValues>(emptyForm)
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [errors, setErrors] = useState<Partial<Record<keyof SurveyFormValues, string>>>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    void getFeedback(context.semester, professorId, token, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setForm(responseToForm(response))
        setLoadState({ status: 'ready', previouslySubmitted: true })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return

        if (error instanceof ApiError && error.status === 404) {
          setForm(emptyForm)
          setLoadState({ status: 'ready', previouslySubmitted: false })
          return
        }

        setLoadState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The feedback survey could not be loaded.',
        })
      })

    return () => controller.abort()
  }, [context.semester, professorId, token])

  function updateField<Key extends keyof SurveyFormValues>(
    key: Key,
    value: SurveyFormValues[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }))
    }
    setNotice('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: Partial<Record<keyof SurveyFormValues, string>> = {}
    if (!form.semesterRole) {
      nextErrors.semesterRole = 'Select how you participated this cycle.'
    }
    if (!form.processOk) {
      nextErrors.processOk = 'Select an answer about the process.'
    }
    setErrors(nextErrors)

    if (!form.semesterRole || !form.processOk) return

    const request: SaveFeedbackRequest = {
      semester: context.semester,
      semester_role: form.semesterRole,
      process_OK: form.processOk,
      difficulties: form.difficulties.trim() || null,
      improvements: form.improvements.trim() || null,
    }

    setSaving(true)
    setNotice('')
    try {
      const response = await saveFeedback(request, token)
      setForm(responseToForm(response))
      setLoadState({ status: 'ready', previouslySubmitted: true })
      setNotice('Your feedback was saved. You may update it until the survey closes.')
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Your feedback could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loadState.status === 'loading') {
    return (
      <section aria-live="polite" className="feedback-state">
        <span aria-hidden="true" className="feedback-loading-indicator" />
        <div>
          <h2>Loading your survey</h2>
          <p>Checking for a previously submitted response.</p>
        </div>
      </section>
    )
  }

  if (loadState.status === 'error') {
    return (
      <section className="feedback-state feedback-state--error" role="alert">
        <p className="feedback-state__eyebrow">Survey unavailable</p>
        <h2>We could not load your feedback survey</h2>
        <p>{loadState.message}</p>
      </section>
    )
  }

  return (
    <form className="feedback-card" onSubmit={handleSubmit}>
      {loadState.previouslySubmitted && (
        <div className="feedback-saved-note">
          You previously submitted this survey. Changes will replace your saved response.
        </div>
      )}

      <ChoiceGroup
        error={errors.semesterRole}
        legend="This cycle I was"
        name="semester-role"
        onChange={(value) => updateField('semesterRole', value)}
        options={semesterRoleOptions}
        value={form.semesterRole}
      />

      <ChoiceGroup
        error={errors.processOk}
        legend="Was the process OK?"
        name="process-ok"
        onChange={(value) => updateField('processOk', value)}
        options={processOptions}
        value={form.processOk}
      />

      <label className="feedback-text-field">
        <span>What difficulties did you run into?</span>
        <textarea
          onChange={(event) => updateField('difficulties', event.target.value)}
          rows={5}
          value={form.difficulties}
        />
      </label>

      <label className="feedback-text-field">
        <span>How could we improve the process?</span>
        <textarea
          onChange={(event) => updateField('improvements', event.target.value)}
          rows={5}
          value={form.improvements}
        />
      </label>

      <div className="feedback-form-footer">
        <div aria-live="polite" className="feedback-notice">
          {notice}
        </div>
        <button className="button button--primary" disabled={saving} type="submit">
          {saving
            ? 'Saving…'
            : loadState.previouslySubmitted
              ? 'Update survey'
              : 'Submit survey'}
        </button>
      </div>
    </form>
  )
}

export default function FeedbackSurveyPage() {
  const { token, userId } = useAuth()
  const {
    semester,
    isLoading: isSemesterLoading,
    error: semesterError,
    retry: retrySemester,
  } = useCurrentSemester()

  if (!token || !userId) {
    return (
      <section className="screen-page participant-page feedback-page">
        <section className="feedback-state feedback-state--error" role="alert">
          <p className="feedback-state__eyebrow">Session unavailable</p>
          <h1>Feedback survey</h1>
          <p>Please sign in again to access your survey.</p>
        </section>
      </section>
    )
  }

  if (isSemesterLoading) {
    return (
      <section className="screen-page participant-page feedback-page">
        <section aria-live="polite" className="feedback-state">
          <span aria-hidden="true" className="feedback-loading-indicator" />
          <div>
            <h1>Loading feedback survey</h1>
            <p>Retrieving the current semester.</p>
          </div>
        </section>
      </section>
    )
  }

  if (semesterError || !semester) {
    return (
      <section className="screen-page participant-page feedback-page">
        <section className="feedback-state feedback-state--error" role="alert">
          <p className="feedback-state__eyebrow">Survey unavailable</p>
          <h1>We could not determine the current semester</h1>
          <p>{semesterError ?? 'The current semester is unavailable.'}</p>
          <button className="button button--outline" onClick={retrySemester} type="button">
            Retry
          </button>
        </section>
      </section>
    )
  }

  const surveyContext: FeedbackSurveyContext = {
    semester,
    feedbackDeadline: null,
  }

  return (
    <section className="screen-page participant-page feedback-page">
      <header className="feedback-header">
        <p className="feedback-header__eyebrow">
          {surveyContext.feedbackDeadline
            ? `Due ${formatDeadline(surveyContext.feedbackDeadline)}`
            : surveyContext.semester}
        </p>
        <h1>How did this cycle go?</h1>
        <p>Your answers help the Assessment Committee improve the process.</p>
      </header>

      <FeedbackSurveyForm
        context={surveyContext}
        professorId={userId}
        token={token}
      />
    </section>
  )
}
