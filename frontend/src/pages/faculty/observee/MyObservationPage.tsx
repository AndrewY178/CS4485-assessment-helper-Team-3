import { useEffect, useState } from 'react'
import { cancelObservation, getObserveeEvaluations, saveObserveeResponse, signAsObservee } from '../../../api/evaluations'
import EvaluationQuestions from '../../../components/evaluation/EvaluationQuestions'
import { useAuth } from '../../../context/AuthContext'
import type { EvaluationRecord } from '../../../types/evaluation'
import '../../../styles/evaluation.css'

export default function MyObservationPage() {
  const { token } = useAuth()
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [selected, setSelected] = useState<EvaluationRecord | null>(null)
  const [response, setResponse] = useState('')
  const [typedName, setTypedName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    getObserveeEvaluations(token, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setEvaluations(result.evaluations)
        if (result.evaluations.length) {
          setSelected(result.evaluations[0])
          setResponse(result.evaluations[0].observeeResponse)
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load your observations.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token])

  function selectEvaluation(evaluation: EvaluationRecord) {
    setSelected(evaluation)
    setResponse(evaluation.observeeResponse)
    setTypedName('')
    setError('')
    setNotice('')
  }

  async function saveResponse() {
    if (!token || !selected) return
    setBusy(true)
    setError('')
    try {
      const result = await saveObserveeResponse(selected.id, response, token)
      setSelected(result.evaluation)
      setEvaluations((current) => current.map((item) => item.id === result.evaluation.id ? result.evaluation : item))
      setNotice('Your response was saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your response.')
    } finally {
      setBusy(false)
    }
  }

  async function signEvaluation() {
    if (!token || !selected) return
    setBusy(true)
    setError('')
    try {
      const result = await signAsObservee(selected.id, typedName, response, token)
      setSelected(result.evaluation)
      setEvaluations((current) => current.map((item) => item.id === result.evaluation.id ? result.evaluation : item))
      setNotice('You signed the observation. The completed record is now locked.')
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : 'Could not sign this observation.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelSelectedObservation() {
    if (!token || !selected || selected.status !== 'upcoming') return
    setBusy(true)
    setError('')
    try {
      await cancelObservation(selected.meetingId, token)
      const canceled = { ...selected, status: 'canceled' as const, questions: [], answers: {} }
      setEvaluations((current) => current.map((item) => item.id === selected.id ? canceled : item))
      setSelected(canceled)
      setNotice('This observation was canceled.')
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel this observation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen-page participant-page observation-page">
      <header className="participant-header">
        <div>
          <span className={`status-label${selected?.status === 'complete' ? ' status-label--complete' : ''}`}>
            {selected?.status === 'complete' ? 'COMPLETE' : selected?.status === 'canceled' ? 'CANCELED' : selected?.status === 'upcoming' ? 'UPCOMING' : selected ? 'WAITING FOR YOUR SIGNATURE' : 'OBSERVATIONS'}
          </span>
          <h1>My observations</h1>
          <p>View scheduled observations and review evaluations signed by your observers.</p>
        </div>
      </header>
      {error && !selected && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="signed-confirmation" role="status">{notice}</p>}
      {loading ? <p role="status">Loading observations…</p> : evaluations.length === 0 ? (
        <p>No observations are available yet.</p>
      ) : (
        <>
          <label className="evaluation-select-label" htmlFor="my-observation-select">Choose an observation</label>
          <select
            id="my-observation-select"
            onChange={(event) => {
              const item = evaluations.find((evaluation) => evaluation.id === Number(event.target.value))
              if (item) selectEvaluation(item)
            }}
            value={selected?.id ?? ''}
          >
            {evaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                {evaluation.course.code} · {evaluation.semester} · {evaluation.observer.name}
                {evaluation.status === 'canceled' ? ' · canceled' : evaluation.status === 'upcoming' ? ' · upcoming' : evaluation.status === 'complete' ? ' · complete' : ' · signature needed'}
              </option>
            ))}
          </select>
        </>
      )}

      {selected?.status === 'upcoming' && (
        <section className="observation-ratings" aria-labelledby="observation-template-title">
          <h2 id="observation-template-title">{selected.course.code} · {selected.course.title}</h2>
          <p>{selected.semester} · scheduled {selected.meetingDate} with {selected.observer.name}</p>
          {selected.questions.length > 0 ? (
            <>
              <h3>Evaluation template</h3>
              <EvaluationQuestions answers={{}} editable={false} questions={selected.questions} />
            </>
          ) : <p>No evaluation template is available for this cycle yet.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--outline" disabled={busy} onClick={() => void cancelSelectedObservation()} type="button">
            {busy ? 'Canceling…' : 'Cancel observation'}
          </button>
        </section>
      )}

      {selected?.status === 'canceled' && (
        <section className="observation-ratings" aria-labelledby="canceled-observation-title">
          <h2 id="canceled-observation-title">{selected.course.code} · {selected.course.title}</h2>
          <p>{selected.semester} · scheduled {selected.meetingDate} with {selected.observer.name}</p>
          <p>This observation was canceled.</p>
        </section>
      )}

      {selected && selected.status !== 'upcoming' && selected.status !== 'canceled' && (
        <>
          <section className="observation-ratings" aria-labelledby="observation-summary-title">
            <h2 id="observation-summary-title">{selected.course.code} · {selected.course.title}</h2>
            <p>{selected.semester} · observed {selected.meetingDate} by {selected.observer.name}</p>
            <p>Observer signed: {selected.observerSignature.name} · {selected.observerSignature.signedAt}</p>
            <EvaluationQuestions answers={selected.answers} editable={false} questions={selected.questions} />
            <article className="rating-row rating-row--comments">
              <div>
                <h3>Your response</h3>
                {selected.status === 'complete' ? <p>{selected.observeeResponse || 'No response added.'}</p> : (
                  <textarea
                    aria-label="Optional response"
                    disabled={busy}
                    onChange={(event) => setResponse(event.target.value)}
                    placeholder="Anything you want on record alongside this observation"
                    rows={4}
                    value={response}
                  />
                )}
              </div>
            </article>
          </section>
          {selected.status === 'complete' ? (
            <p className="signed-confirmation">Signed by {selected.observeeSignature.name} · {selected.observeeSignature.signedAt}. This record is read-only.</p>
          ) : (
            <form className="observation-sign-form" onSubmit={(event) => { event.preventDefault(); void signEvaluation() }}>
              <section className="sign-section">
                <h2>Sign this observation</h2>
                <p className="sign-explanation">Your signature records that you reviewed this evaluation. You do not have to agree with the ratings.</p>
                <label className="observation-field-label" htmlFor="observee-signature-name">Type your full name</label>
                <input id="observee-signature-name" onChange={(event) => setTypedName(event.target.value)} value={typedName} />
                {error && <p className="form-error" role="alert">{error}</p>}
              </section>
              <div className="observee-signup-actions">
                <button className="button button--outline" disabled={busy} onClick={() => void saveResponse()} type="button">Save response</button>
                <button className="button button--primary signature-submit" disabled={busy} type="submit">Sign observation</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
