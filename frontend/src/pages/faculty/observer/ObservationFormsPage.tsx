import { useEffect, useState } from 'react'
import {
  getEvaluation,
  getObserverEvaluations,
  saveObserverAnswers,
  signAsObserver,
  startEvaluation,
} from '../../../api/evaluations'
import EvaluationQuestions from '../../../components/evaluation/EvaluationQuestions'
import { useAuth } from '../../../context/AuthContext'
import type { EvaluationRecord, EvaluationValue, ObserverEvaluationItem } from '../../../types/evaluation'
import '../../../styles/observation-forms.css'
import '../../../styles/evaluation.css'

export default function ObservationFormsPage() {
  const { token } = useAuth()
  const [observations, setObservations] = useState<ObserverEvaluationItem[]>([])
  const [selected, setSelected] = useState<EvaluationRecord | null>(null)
  const [answers, setAnswers] = useState<Record<string, EvaluationValue>>({})
  const [typedName, setTypedName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    getObserverEvaluations(token, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setObservations(result.observations)
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load assigned observations.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token])

  async function refreshList() {
    if (!token) return
    const result = await getObserverEvaluations(token)
    setObservations(result.observations)
  }

  async function openObservation(item: ObserverEvaluationItem) {
    if (!token) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = item.evaluationId
        ? await getEvaluation(item.evaluationId, token)
        : await startEvaluation(item.meetingId, token)
      setSelected(result.evaluation)
      setAnswers(result.evaluation.answers)
      setTypedName('')
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open the evaluation.')
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!token || !selected) return
    setBusy(true)
    setError('')
    try {
      const result = await saveObserverAnswers(selected.id, answers, token)
      setSelected(result.evaluation)
      setAnswers(result.evaluation.answers)
      setNotice('Draft saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this draft.')
    } finally {
      setBusy(false)
    }
  }

  async function signEvaluation() {
    if (!token || !selected) return
    setBusy(true)
    setError('')
    try {
      const result = await signAsObserver(selected.id, typedName, answers, token)
      setSelected(result.evaluation)
      await refreshList()
      setNotice('Evaluation signed and sent to the observee for review.')
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : 'Could not sign this evaluation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen-page participant-page observation-forms-page">
      <header className="participant-header">
        <div>
          <h1>Observation forms</h1>
          <p>Complete and sign evaluations for your confirmed observations.</p>
        </div>
      </header>
      {error && !selected && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="signed-confirmation" role="status">{notice}</p>}
      {loading ? <p role="status">Loading assigned observations…</p> : observations.length === 0 ? (
        <p>No confirmed observations are assigned to you.</p>
      ) : (
        <div className="evaluation-assignment-list">
          {observations.map((item) => (
            <article className="evaluation-assignment" key={item.meetingId}>
              <div>
                <h2>{item.course.code} · {item.observeeName}</h2>
                <p>{item.course.title} · {item.semester} · {item.meetingDate}</p>
                <p>{item.status === 'complete' ? 'Fully signed' : item.status === 'awaiting_observee' ? 'Signed · waiting for observee' : item.status === 'draft' ? 'Draft in progress' : item.deadlinePassed ? 'Ready to start' : 'Available after signup closes'}</p>
              </div>
              <button className="button button--outline" disabled={busy || (!item.deadlinePassed && !item.evaluationId)} onClick={() => void openObservation(item)} type="button">
                {item.evaluationId ? 'Open evaluation' : 'Start evaluation'}
              </button>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <section className="evaluation-workspace" aria-labelledby="evaluation-title">
          <header>
            <h2 id="evaluation-title">{selected.course.code} · {selected.observee.name}</h2>
            <p>{selected.semester} · observed {selected.meetingDate}</p>
            <button className="template-link-button" onClick={() => setSelected(null)} type="button">Close evaluation</button>
          </header>
          <EvaluationQuestions
            answers={answers}
            editable={!selected.observerSignature.signedAt}
            onChange={(questionId, value) => setAnswers((current) => {
              const next = { ...current }
              if (value === '') delete next[questionId]
              else next[questionId] = value
              return next
            })}
            questions={selected.questions}
          />
          {selected.observerSignature.signedAt ? (
            <p className="signed-confirmation">Signed by {selected.observerSignature.name} on {selected.observerSignature.signedAt}.</p>
          ) : (
            <form className="sign-section" onSubmit={(event) => { event.preventDefault(); void signEvaluation() }}>
              <label className="observation-field-label" htmlFor="observer-signature-name">Type your full name to sign</label>
              <input id="observer-signature-name" onChange={(event) => setTypedName(event.target.value)} value={typedName} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="observee-signup-actions">
                <button className="button button--outline" disabled={busy} onClick={() => void saveDraft()} type="button">{busy ? 'Saving…' : 'Save draft'}</button>
                <button className="button button--primary signature-submit" disabled={busy} type="submit">Sign and send to observee</button>
              </div>
            </form>
          )}
        </section>
      )}
    </section>
  )
}
