import type { ObserverCandidateResponse, ObserverSelectionResponse } from '../../types/api'
import SelectionStatusBadge from './SelectionStatusBadge'

interface CandidatePanelProps {
  row: ObserverSelectionResponse
  onApprove: () => void
  onGenerate: () => void
  onRefresh: () => void
  onReopen: () => void
  onToggle: (facultyId: string) => void
}

function CandidateRow({
  candidate,
  checked,
  editable,
  onToggle,
}: {
  candidate: ObserverCandidateResponse
  checked: boolean
  editable: boolean
  onToggle: () => void
}) {
  const unavailable = candidate.eligibilityStatus === 'unavailable'

  return (
    <label className={`observer-candidate ${checked ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''}`}>
      <input
        checked={checked}
        disabled={!editable || unavailable}
        onChange={onToggle}
        type="checkbox"
      />
      <span className="observer-candidate__content">
        <span className="observer-candidate__heading">
          <strong>{candidate.name}</strong>
          <span className={`observer-candidate__eligibility observer-candidate__eligibility--${candidate.eligibilityStatus}`}>
            {unavailable ? 'Unavailable' : 'Eligible'}
          </span>
        </span>
        <span className="observer-candidate__meta">
          {candidate.department} · {candidate.relevantCourseLevel}
        </span>
        <span className="observer-candidate__capacity">
          Workload: {candidate.currentObservationCount} of 3 · {candidate.remainingCapacity} remaining
        </span>
        <span className="observer-candidate__availability">{candidate.scheduleCompatibility}</span>
        <span className="observer-candidate__reasons">{candidate.matchingReasons.join(' · ')}</span>
      </span>
    </label>
  )
}

export default function CandidatePanel({
  row,
  onApprove,
  onGenerate,
  onRefresh,
  onReopen,
  onToggle,
}: CandidatePanelProps) {
  const editable = row.status === 'pending-review'
  const selectedCount = row.selectedCandidateIds.length
  const canApprove = editable && selectedCount >= 1 && selectedCount <= 5

  return (
    <aside aria-labelledby="observer-candidate-title" className="observer-candidate-panel">
      <header className="observer-candidate-panel__header">
        <div>
          <span className="observer-candidate-panel__eyebrow">Candidate review</span>
          <h2 id="observer-candidate-title">{row.observee.name}</h2>
          <p>
            {row.course.code}-{row.course.section} · {row.course.meetingDays.join('/')} · {row.course.startTime}–{row.course.endTime}
          </p>
        </div>
        <SelectionStatusBadge status={row.status} />
      </header>

      {row.warning && <p className="observer-candidate-panel__warning" role="alert">{row.warning}</p>}

      {row.status === 'not-generated' && (
        <div className="observer-candidate-panel__empty">
          <h3>Recommendations not generated</h3>
          <p>Run matching for this faculty member or use the page-level action.</p>
          <button className="observer-selection-button observer-selection-button--primary" onClick={onGenerate} type="button">
            Generate recommendations
          </button>
        </div>
      )}

      {row.status === 'no-eligible-observers' && (
        <div className="observer-candidate-panel__empty observer-candidate-panel__empty--alert">
          <h3>No eligible observers found</h3>
          <p>This Observee remains unmatched. Retry matching when availability or workload changes.</p>
          <button className="observer-selection-button observer-selection-button--secondary" onClick={onRefresh} type="button">
            Retry matching
          </button>
        </div>
      )}

      {row.recommendations.length > 0 && (
        <fieldset className="observer-candidate-list">
          <legend>
            Recommended observers
            <span>{selectedCount} selected · maximum 5</span>
          </legend>
          {row.recommendations.map((candidate) => (
            <CandidateRow
              candidate={candidate}
              checked={row.selectedCandidateIds.includes(candidate.facultyId)}
              editable={editable}
              key={candidate.facultyId}
              onToggle={() => onToggle(candidate.facultyId)}
            />
          ))}
        </fieldset>
      )}

      {editable && row.recommendations.length > 0 && (
        <div className="observer-candidate-panel__actions">
          <button className="observer-selection-button observer-selection-button--secondary" onClick={onRefresh} type="button">
            Refresh recommendations
          </button>
          <button
            className="observer-selection-button observer-selection-button--primary"
            disabled={!canApprove}
            onClick={onApprove}
            type="button"
          >
            Approve {selectedCount} candidate{selectedCount === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {row.status === 'approved' && (
        <div className="observer-candidate-panel__state-note">
          <p>This list is approved but can still be revised because invitations have not been sent.</p>
          <button className="observer-selection-button observer-selection-button--secondary" onClick={onReopen} type="button">
            Reopen for editing
          </button>
        </div>
      )}

      {row.status === 'invitations-sent' && (
        <p className="observer-candidate-panel__state-note">
          Invitations have been sent. This candidate list is now read-only.
        </p>
      )}
    </aside>
  )
}
