import { useEffect, useState } from 'react'
import ApproveCandidatesDialog from '../../components/observer-selection/ApproveCandidatesDialog'
import CandidatePanel from '../../components/observer-selection/CandidatePanel'
import ObserveeSelectionTable from '../../components/observer-selection/ObserveeSelectionTable'
import SelectionSummary from '../../components/observer-selection/SelectionSummary'
import { useAuth } from '../../context/AuthContext'
import {
  observerSelectionContext,
} from '../../data/observerSelectionMockData'
import type { ObserverCandidateResponse, ObserverSelectionResponse, ObserveeResponse} from '../../types/api'
import '../../styles/observer-selection.css'
import { generateObserverLists, getObserverList, regenerateObserverList } from '../../api/observers'
import { ApiError } from '../../api/auth'
import { getObservees } from '../../api/observees'

function formatMeetingDays(days: string | null): string[] {
  if (!days) return []

  const labels: Record<string, string> = {
    M: 'Mon',
    T: 'Tue',
    W: 'Wed',
    R: 'Thu',
    F: 'Fri',
  }

  return [...days].map((day) => labels[day] ?? day)
}

function formatTime(time: string | null): string {
  if (!time) return '—'

  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12

  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function toObserverSelectionRow(
  observee: ObserveeResponse,
): ObserverSelectionResponse {
  return {
    observationId: String(observee.id),
    semesterId: observee.signup_sem,
    observee: observee,
    course: {
      code: [
        observee.course_department,
        observee.course_number,
      ].filter(Boolean).join(' ') || '—',
      section: observee.section_number ?? '—',
      title: observee.course_name ?? '—',
      meetingDays: formatMeetingDays(observee.course_day),
      startTime: formatTime(observee.course_start_time),
      endTime: formatTime(observee.course_end_time),
    },
    status: observee.status,
    recommendations: [],
    selectedCandidateIds: [],
  }
}

function selectedEligibleIds(recommendations: ObserverCandidateResponse[]) {
  return recommendations
    .map((candidate) => candidate.observer_id)
    .slice(0, 5)
}

function generatedState(
  row: ObserverSelectionResponse,
  recommendations: ObserverCandidateResponse[],
): ObserverSelectionResponse {

  if (recommendations.length === 0) {
    return {
      ...row,
      status: 'no_observers',
      recommendations,
      selectedCandidateIds: [],
      warning: 'No eligible observers were found for this course and meeting time.',
    }
  }

  return {
    ...row,
    status: 'generated',
    recommendations: recommendations.slice(0, 5),
    selectedCandidateIds: selectedEligibleIds(recommendations),
    warning: recommendations.length < 5
      ? `Only ${recommendations.length} eligible observer candidate${recommendations.length === 1 ? ' was' : 's were'} found.`
      : undefined,
  }
}

export default function ObserverSelectionPage() {
  const { roles } = useAuth()
  const [rows, setRows] = useState<ObserverSelectionResponse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      try {
        setIsLoading(true)
        setError(null)

        const observees = await getObservees(
          observerSelectionContext.currentSemester.label,
        )

        if (!cancelled) {
          const nextRows = observees.map(toObserverSelectionRow)
          setRows(nextRows)
          setSelectedId(nextRows[0]?.observationId ?? null)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'Unable to load observees.',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return <p>Loading observees...</p>
  }

  if (error) {
    return <p role="alert">{error}</p>
  }

  if (rows.length === 0 || !selectedId) {
    return <p>No observees found for this semester.</p>
  }

  const selectedRow = rows.find((row) => row.observationId === selectedId) ?? rows[0]

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4200)
  }

  async function reviewObservee(observationId: string) {
    setSelectedId(observationId)

    const row = rows.find((item) => item.observationId === observationId)
    if (!row) return

    try {
      const recommendations = await getObserverList(
        row.observee.id,
        row.semesterId,
      )

      setRows((current) => current.map((currentRow) => (
        currentRow.observationId === observationId
          ? {
              ...currentRow,
              recommendations,
              selectedCandidateIds: [],
              status: row.observee.status,
              warning: recommendations.length === 0
                ? 'No observers were found for this Observee.'
                : undefined,
            }
          : currentRow
      )))
    } catch (caught) {
      showNotice(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load the observer list.',
      )
    }
  }

  async function runObserverSelection() {
    if (!observerSelectionContext.signupDeadlinePassed) {
      showNotice('Observer selection is disabled until the sign-up deadline passes.')
      return
    }

    const notGenerated = rows.filter((row) => row.status === 'not_generated')
    if (notGenerated.length === 0) {
      showNotice('No Observees are waiting for initial recommendations.')
      return
    }

    try {
      const result = await generateObserverLists(
        observerSelectionContext.currentSemester.label,
      )

      const refreshedObservees = await getObservees(
        observerSelectionContext.currentSemester.label,
      )

      const failures = new Map(
        result.failures.map((item) => [
          String(item.observee_id),
          item.error,
        ]),
      )

      const nextRows = refreshedObservees.map((observee) => {
        const row = toObserverSelectionRow(observee)
        const failure = failures.get(String(observee.id))

        return failure
          ? { ...row, warning: failure}
          : row
      })

      setRows(nextRows)

      setSelectedId((currentSelectedId) => (
        nextRows.some((row) => row.observationId === currentSelectedId)
          ? currentSelectedId
          : nextRows[0]?.observationId ?? null
      ))

      showNotice(
        `Generated observer lists for ${result.generated} Observee${
          result.generated === 1 ? '' : 's'
        }.`,
      )
    } catch (error) {
      showNotice(
        error instanceof ApiError
          ? error.message
          : 'Unable to generate observer lists.',
      )
    }
  }

  async function refreshRecommendations() {
    if (selectedRow.status === 'invitations_sent' || selectedRow.status === 'approved') return

    // TODO(API): POST /api/observer-selection/run with observationId to refresh
    // one record. The backend must re-check availability and capacity.
    try {
      const recommendations = await regenerateObserverList(
        selectedRow.observee.id,
        selectedRow.semesterId,
      )
      console.log(recommendations)

      setRows((current) => current.map((row) => (
        row.observationId === selectedRow.observationId
          ? {
              ...row,
              status: row.observee.status,
              recommendations,
              selectedCandidateIds: [],
              warning: recommendations.length === 0
                ? 'No eligible observers were found for this course and meeting time.'
                : recommendations.length < 5
                  ? `Only ${recommendations.length} eligible observer candidates were found.`
                  : undefined,
            }
          : row
      )))

      showNotice(
        recommendations.length > 0
          ? `Recommendations refreshed for ${selectedRow.observee.name}.`
          : `No eligible observers were found for ${selectedRow.observee.name}.`,
      )
    } catch (caught) {
      showNotice(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to regenerate the observer list.',
      )
    }
  }

  function toggleCandidate(facultyId: string) {
    if (selectedRow.status !== 'generated') return

    setRows((current) => current.map((row) => {
      if (row.observationId !== selectedRow.observationId) return row
      const candidate = row.recommendations.find((item) => item.observer_id === facultyId)
      if (!candidate) return row

      const selected = row.selectedCandidateIds.includes(facultyId)
        ? row.selectedCandidateIds.filter((id) => id !== facultyId)
        : [...row.selectedCandidateIds, facultyId].slice(0, 5)

      return { ...row, selectedCandidateIds: selected }
    }))
  }

  function confirmApproval() {
    const validIds = selectedRow.selectedCandidateIds.filter((id) => (
      selectedRow.recommendations.some((candidate) => (
        candidate.observer_id === id
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

  // TODO: make this send a put request that updates the observee status
  function reopenList() {
    if (selectedRow.status !== 'approved') return
    setRows((current) => current.map((row) => (
      row.observationId === selectedRow.observationId
        ? { ...row, status: 'generated' }
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

      <SelectionSummary rows={rows} />

      <div className="observer-selection-layout">
        <section aria-labelledby="observer-selection-table-title" className="observer-selection-main">
          <header className="observer-selection-section-heading">
            <div>
              <h2 id="observer-selection-table-title">Faculty awaiting observer selection</h2>
              <p>Review up to five eligible candidates for each Observee.</p>
            </div>
          </header>
          <ObserveeSelectionTable onReview={reviewObservee} rows={rows} selectedId={selectedId} />
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
