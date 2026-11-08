import { useState, type FormEvent } from 'react'

const ratings = [
  { label: 'Clear learning objectives', note: 'Objectives on the first slide and revisited at the end.', score: 4 },
  { label: 'Student engagement', note: 'Good questions early; fewer later in class.', score: 3 },
  { label: 'Organization and pacing', note: 'Smooth transitions between topics.', score: 4 },
  { label: 'Use of examples', note: 'Live-coded example landed well.', score: 5 },
]

export default function MyObservationPage() {
  const [response, setResponse] = useState('')
  const [fileName, setFileName] = useState('')
  const [signature, setSignature] = useState('')
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState('')

  function signObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (signature.trim().toLowerCase() !== 'dr. priya raman') {
      setError('Enter your full name as Dr. Priya Raman to sign this observation.')
      return
    }
    setError('')
    setSigned(true)
  }

  return (
    <section className="screen-page participant-page observation-page">
      <header className="participant-header">
        <div>
          <span className={`status-label${signed ? ' status-label--complete' : ''}`}>
            {signed ? 'SIGNED' : 'WAITING FOR YOUR SIGNATURE'}
          </span>
          <h1>Your observation - CS 1337.002</h1>
          <p>Observed by Dr. L. Ortiz on Wed, Nov 5. | Dr. Ortiz signed on Nov 5.</p>
        </div>
      </header>

      <section aria-labelledby="ratings-title" className="observation-ratings">
        <h2 id="ratings-title">Ratings and notes</h2>
        {ratings.map(({ label, note, score }) => (
          <article className="rating-row" key={label}>
            <div>
              <h3>{label}</h3>
              <p>{note}</p>
            </div>
            <span className="rating-score">{score}/5</span>
          </article>
        ))}
        <article className="rating-row rating-row--comments">
          <div>
            <h3>Overall comments</h3>
            <p>Well-structured session with strong examples. Consider more check-ins during the second half.</p>
          </div>
        </article>
      </section>

      <form className="observation-sign-form" onSubmit={signObservation}>
        <fieldset disabled={signed}>
          <legend>Add your view <span>(optional)</span></legend>
          <label className="observation-field-label" htmlFor="observation-response">Response</label>
          <textarea
            id="observation-response"
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Anything you want on record alongside this observation"
            rows={3}
            value={response}
          />
          <label className="observation-file">
            <span className="visually-hidden">Attach a file</span>
            <input
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
              type="file"
            />
            {fileName && <span className="observation-file__name">Selected: {fileName}</span>}
          </label>
        </fieldset>

        <fieldset className="sign-section" disabled={signed}>
          <legend>Sign</legend>
          <p className="sign-explanation">
            Your signature confirms this observation happened on Nov. 5. It does not mean you agree with the ratings. After you sign, this record is locked.
          </p>
          <label className="observation-field-label" htmlFor="signature-name">Type your full name</label>
          <input
            autoComplete="name"
            id="signature-name"
            onChange={(event) => setSignature(event.target.value)}
            placeholder="Dr. Priya Raman"
            type="text"
            value={signature}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
        </fieldset>

        {signed ? (
          <p className="signed-confirmation" role="status">Observation signed. Your response is now part of the record.</p>
        ) : (
          <button className="button button--primary signature-submit" type="submit">Sign observation</button>
        )}
      </form>
    </section>
  )
}
