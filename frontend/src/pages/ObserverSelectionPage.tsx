import { useState } from 'react'
import ApproveCandidatesDialog from '../components/observer-selection/ApproveCandidatesDialog'
import CandidatePanel from '../components/observer-selection/CandidatePanel'
import ObserveeSelectionTable from '../components/observer-selection/ObserveeSelectionTable'
import SelectionSummary from '../components/observer-selection/SelectionSummary'
import { useAuth } from '../context/AuthContext'
import {
  getMockRecommendations,
  initialObserverSelectionRows,
  observerSelectionContext,
} from '../data/observerSelectionMockData'
import type { ObserverCandidateResponse, ObserverSelectionResponse } from '../types/api'
import '../styles/observer-selection.css'

function selectedEligibleIds(recommendations: ObserverCandidateResponse[]) {
  return recommendations
    .filter((candidate) => candidate.eligibilityStatus === 'eligible')
    .map((candidate) => candidate.facultyId)
    .slice(0, 5)
}

function generatedState(
  row: ObserverSelectionResponse,
  recommendations: ObserverCandidateResponse[],
): ObserverSelectionResponse {
  const eligible = recommendations.filter((candidate) => candidate.eligibilityStatus === 'eligible')

  if (eligible.length === 0) {
    return {
      ...row,
      status: 'no-eligible-observers',
      recommendations,
      selectedCandidateIds: [],
      warning: 'No eligible observers were found for this course and meeting time.',
    }
  }

  return {
    ...row,
    status: 'pending-review',
    recommendations: recommendations.slice(0, 5),
    selectedCandidateIds: selectedEligibleIds(recommendations),
    warning: eligible.length < 5
      ? `Only ${eligible.length} eligible observer candidate${eligible.length === 1 ? ' was' : 's were'} found.`
      : undefined,
  }
}

export default function ObserverSelectionPage() {
  const { roles } = useAuth()
  const [rows, setRows] = useState(initialObserverSelectionRows)
  const [selectedId, setSelectedId] = useState(rows[0].observationId)
  const [attempts, setAttempts] = useState<Record<string, number>>({ 'observation-205': 1 })
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const selectedRow = rows.find((row) => row.observationId === selectedId) ?? rows[0]

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4200)
  }

  function runObserverSelection() {
    if (!observerSelectionContext.signupDeadlinePassed) {
      showNotice('Observer selection is disabled until the sign-up deadline passes.')
      return
    }

    const notGenerated = rows.filter((row) => row.status === 'not-generated')
    if (notGenerated.length === 0) {
      showNotice('No Observees are waiting for initial recommendations.')
      return
    }

    // TODO(API): POST /api/observer-selection/run with the current semester ID.
    // Flask will generate matches only for signed-up, not-yet-generated records.
    setRows((current) => current.map((row) => {
      if (row.status !== 'not-generated') return row
      return generatedState(row, getMockRecommendations(row.observationId, attempts[row.observationId] ?? 0))
    }))
    setAttempts((current) => {
      const next = { ...current }
      notGenerated.forEach((row) => { next[row.observationId] = (next[row.observationId] ?? 0) + 1 })
      return next
    })
    showNotice(`Mock matching generated recommendations for ${notGenerated.length} Observee${notGenerated.length === 1 ? '' : 's'}. No lists were approved.`)
  }

  function refreshRecommendations() {
    if (selectedRow.status === 'invitations-sent' || selectedRow.status === 'approved') return
    const attempt = attempts[selectedRow.observationId] ?? 0

    // TODO(API): POST /api/observer-selection/run with observationId to refresh
    // one record. The backend must re-check availability and capacity.
    const recommendations = getMockRecommendations(selectedRow.observationId, attempt)
    setRows((current) => current.map((row) => (
      row.observationId === selectedRow.observationId
        ? generatedState(row, recommendations)
        : row
    )))
    setAttempts((current) => ({
      ...current,
      [selectedRow.observationId]: attempt + 1,
    }))
    showNotice(
      recommendations.length > 0
        ? `Mock recommendations refreshed for ${selectedRow.observee.name}.`
        : `No eligible observers were found for ${selectedRow.observee.name}.`,
    )
  }

  function toggleCandidate(facultyId: string) {
    if (selectedRow.status !== 'pending-review') return

    setRows((current) => current.map((row) => {
      if (row.observationId !== selectedRow.observationId) return row
      const candidate = row.recommendations.find((item) => item.facultyId === facultyId)
      if (!candidate || candidate.eligibilityStatus !== 'eligible') return row

      const selected = row.selectedCandidateIds.includes(facultyId)
        ? row.selectedCandidateIds.filter((id) => id !== facultyId)
        : [...row.selectedCandidateIds, facultyId].slice(0, 5)

      return { ...row, selectedCandidateIds: selected }
    }))
  }

  function confirmApproval() {
    const validIds = selectedRow.selectedCandidateIds.filter((id) => (
      selectedRow.recommendations.some((candidate) => (
        candidate.facultyId === id && candidate.eligibilityStatus === 'eligible'
      ))
    ))

    if (validIds.length < 1 || validIds.length > 5) {
      setApprovalOpen(false)
      showNotice('Select between one and five eligible candidates before approval.')
      return
    }

    // TODO(API): PUT /api/observer-selection/{observationId}/approval with
    // { candidateIds: validIds }. Flask must validate every ID before saving.
    setRows((current) => current.map((row) => (
      row.observationId === selectedRow.observationId
        ? { ...row, status: 'approved', selectedCandidateIds: validIds, warning: undefined }
        : row
    )))
    setApprovalOpen(false)
    showNotice('Candidate list approved in this browser session. No invitations were sent.')
  }

  function reopenList() {
    if (selectedRow.status !== 'approved') return
    setRows((current) => current.map((row) => (
      row.observationId === selectedRow.observationId
        ? { ...row, status: 'pending-review' }
        : row
    )))
    showNotice('Approved list reopened for editing in this browser session.')
  }

  if (!roles.includes('AC Member')) {
    return (
      <section className="observer-selection-access-denied">
        <h1>Observer selection</h1>
        <p>Only Assessment Committee members can generate and approve observer recommendations.</p>
      </section>
    )
  }

  return (
    <section className="observer-selection-page">
      <header className="observer-selection-page__header">
        <div>
          <h1>Observer selection</h1>
          <p>{observerSelectionContext.currentSemester.label} · Review recommendations before Observees send invitations.</p>
        </div>
        <button
          className="observer-selection-button observer-selection-button--primary"
          disabled={!observerSelectionContext.signupDeadlinePassed}
          onClick={runObserverSelection}
          type="button"
        >
          Run Observer Selection
        </button>
      </header>

      {notice && <div className="observer-selection-toast" role="status">{notice}</div>}

      <div className="observer-selection-notices">
        <p>
          <strong>Mock deadline check:</strong> Sign-up deadline has passed. Replace this value with Cycle Setup or Flask data later.
        </p>
        <p>Prototype actions are stored only in React state and will be lost on refresh.</p>
      </div>

      <SelectionSummary rows={rows} />

      <div className="observer-selection-layout">
        <section aria-labelledby="observer-selection-table-title" className="observer-selection-main">
          <header className="observer-selection-section-heading">
            <div>
              <h2 id="observer-selection-table-title">Faculty awaiting observer selection</h2>
              <p>Review up to five eligible candidates for each Observee.</p>
            </div>
          </header>
          <ObserveeSelectionTable onReview={setSelectedId} rows={rows} selectedId={selectedId} />
        </section>

        <CandidatePanel
          onApprove={() => setApprovalOpen(true)}
          onGenerate={refreshRecommendations}
          onRefresh={refreshRecommendations}
          onReopen={reopenList}
          onToggle={toggleCandidate}
          row={selectedRow}
        />
      </div>

      {approvalOpen && (
        <ApproveCandidatesDialog
          candidateCount={selectedRow.selectedCandidateIds.length}
          observeeName={selectedRow.observee.name}
          onCancel={() => setApprovalOpen(false)}
          onConfirm={confirmApproval}
        />
      )}
    </section>
  )
}
