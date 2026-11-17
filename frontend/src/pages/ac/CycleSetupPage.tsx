import { useEffect, useMemo, useState } from 'react'
import CycleTimelinePreview from '../../components/cycle/CycleTimelinePreview'
import DeadlineField from '../../components/cycle/DeadlineField'
import { ApiError } from '../../api/auth'
import { saveCycleDeadline } from '../../api/cycles'
import {
  getEvaluationCycles,
  saveEvaluationCycle,
} from '../../api/cycleSetup'
import { useAuth } from '../../context/AuthContext'
import { useCurrentSemester } from '../../hooks/useCurrentSemester'
import type {
  EvaluationCycleResponse,
  SaveEvaluationCycleRequest,
} from '../../types/api'
import '../../styles/cycle-setup.css'

type DeadlineKey = keyof SaveEvaluationCycleRequest
type DeadlineErrors = Partial<Record<DeadlineKey, string>>

function toLocalInputValue(isoValue: string) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function cycleToForm(record: EvaluationCycleResponse): SaveEvaluationCycleRequest {
  return {
    signupDeadline: toLocalInputValue(record.signupDeadline),
    observationDeadline: toLocalInputValue(record.observationDeadline),
    feedbackDeadline: toLocalInputValue(record.feedbackDeadline),
  }
}

function validateDeadlines(values: SaveEvaluationCycleRequest) {
  const errors: DeadlineErrors = {}

  ;(['signupDeadline', 'observationDeadline', 'feedbackDeadline'] as DeadlineKey[]).forEach((key) => {
    const value = values[key]
    if (!value) errors[key] = 'Select a date and time.'
    else if (Number.isNaN(new Date(value).getTime())) errors[key] = 'Enter a valid date and time.'
  })

  if (Object.keys(errors).length > 0) return errors

  const signup = new Date(values.signupDeadline)
  const observation = new Date(values.observationDeadline)

  if (signup >= observation) {
    errors.observationDeadline = 'Observation deadline must occur after sign-up closes.'
  }
  if (values.feedbackDeadline && observation >= new Date(values.feedbackDeadline)) {
    errors.feedbackDeadline = 'Feedback deadline must occur after the observation deadline.'
  }

  return errors
}

export default function CycleSetupPage() {
  const { roles, token } = useAuth()
  const {
    semester,
    nextSemester,
    isLoading: isSemesterLoading,
    error: semesterError,
    retry: retrySemester,
  } = useCurrentSemester()
  const [records, setRecords] = useState<EvaluationCycleResponse[]>([])
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const selectedRecord = records.find((record) => record.semesterId === selectedSemesterId)
  const [form, setForm] = useState<SaveEvaluationCycleRequest>({
    signupDeadline: '',
    observationDeadline: '',
    feedbackDeadline: '',
  })
  const [serverForm, setServerForm] = useState<SaveEvaluationCycleRequest>({
    signupDeadline: '',
    observationDeadline: '',
    feedbackDeadline: '',
  })
  const [errors, setErrors] = useState<DeadlineErrors>({})
  const [notice, setNotice] = useState('')
  const [pageError, setPageError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  const savedForm = useMemo(
    () => selectedRecord ? cycleToForm(selectedRecord) : form,
    [form, selectedRecord],
  )
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)
  const isACMember = roles.includes('AC Member')
  const canEdit = isACMember && !!selectedRecord && selectedRecord.status !== 'closed'

  useEffect(() => {
    const controller = new AbortController()

    async function loadCycles() {
      if (!token) {
        setPageError('Your session is unavailable. Please sign in again.')
        setIsLoading(false)
        return
      }
      if (!semester || !nextSemester) return

      try {
        setIsLoading(true)
        setPageError('')
        const savedCycles = await getEvaluationCycles(token, controller.signal)
        if (controller.signal.aborted) return

        const availableSemesters = [semester, nextSemester]
        const savedBySemester = new Map(savedCycles.map((cycle) => [cycle.semesterId, cycle]))
        const nextRecords = availableSemesters.map((semester) => savedBySemester.get(semester) ?? ({
          id: semester,
          semesterId: semester,
          semesterLabel: semester,
          timezone: 'America/Chicago' as const,
          status: 'draft' as const,
          signupDeadline: '',
          observationDeadline: '',
          feedbackDeadline: '',
          updatedAt: '',
        }))
        const loadedForm = cycleToForm(nextRecords[0])
        setRecords(nextRecords)
        setSelectedSemesterId(availableSemesters[0])
        setForm(loadedForm)
        setServerForm(loadedForm)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPageError(
            loadError instanceof ApiError
              ? loadError.message
              : 'Unable to load evaluation cycles.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadCycles()
    return () => controller.abort()
  }, [loadAttempt, nextSemester, semester, token])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  function selectSemester(semesterId: string) {
    const nextRecord = records.find((record) => record.semesterId === semesterId)
    if (!nextRecord) return
    const next = cycleToForm(nextRecord)
    setSelectedSemesterId(semesterId)
    setForm(next)
    setServerForm(next)
    setErrors({})
  }

  function updateDeadline(key: DeadlineKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function isLocked(key: DeadlineKey) {
    const status = selectedRecord?.status
    if (!canEdit || isSaving) return true
    if (status === 'observation') return key === 'signupDeadline'
    if (status === 'feedback') return key !== 'feedbackDeadline'
    return false
  }

  function requestSave() {
    const nextErrors = validateDeadlines(form)
    ;(['signupDeadline', 'observationDeadline', 'feedbackDeadline'] as DeadlineKey[]).forEach((key) => {
      if (isLocked(key) || !form[key] || form[key] === serverForm[key]) return
      if (new Date(form[key]) <= new Date()) {
        nextErrors[key] = 'Deadline must be in the future.'
      }
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    void commitSave()
  }

  async function commitSave() {
    if (!token || !selectedRecord) return
    try {
      setIsSaving(true)
      setPageError('')
      const savedCycle = await saveEvaluationCycle(selectedSemesterId, {
        signupDeadline: new Date(form.signupDeadline).toISOString(),
        observationDeadline: new Date(form.observationDeadline).toISOString(),
        feedbackDeadline: new Date(form.feedbackDeadline).toISOString(),
      }, token)
      await saveCycleDeadline(
        {
          semester: selectedRecord.semesterLabel,
          signup_deadline: form.signupDeadline.slice(0, 10),
          observation_deadline: form.observationDeadline.slice(0, 10),
        },
        token,
      )
      const savedForm = cycleToForm(savedCycle)
      setRecords((current) => current.map((record) => (
        record.semesterId === savedCycle.semesterId ? savedCycle : record
      )))
      setForm(savedForm)
      setServerForm(savedForm)
      showNotice('Cycle deadlines saved.')
    } catch (saveError) {
      setPageError(
        saveError instanceof ApiError
          ? saveError.message
          : 'Unable to save evaluation cycle.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!isACMember) {
    return (
      <section className="cycle-access-denied">
        <h1>Cycle setup</h1>
        <p>Only Assessment Committee members can configure evaluation cycles.</p>
      </section>
    )
  }

  const displayedError = semesterError ?? pageError
  const displayedLoading = isSemesterLoading || (!displayedError && isLoading)

  if (displayedLoading) {
    return <section aria-live="polite" className="cycle-page"><p>Loading cycle setup…</p></section>
  }

  if (displayedError && records.length === 0) {
    return (
      <section className="cycle-page">
        <h1>Cycle setup</h1>
        <div className="cycle-locked-note" role="alert">
          <p>{displayedError}</p>
          <button
            className="cycle-button cycle-button--secondary"
            onClick={() => {
              if (semesterError) retrySemester()
              else setLoadAttempt((attempt) => attempt + 1)
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (!selectedRecord) return null

  return (
    <section className="cycle-page">
      <header className="cycle-page__header">
        <div>
          <h1>Cycle setup</h1>
          <p>Set the three deadlines that control the faculty evaluation workflow.</p>
        </div>
        <label className="cycle-semester-select" htmlFor="cycle-semester">
          <span>Semester</span>
          <select
            disabled={isSaving}
            id="cycle-semester"
            onChange={(event) => selectSemester(event.target.value)}
            value={selectedSemesterId}
          >
            {records.map((record) => (
              <option key={record.semesterId} value={record.semesterId}>
                {record.semesterLabel}
              </option>
            ))}
          </select>
        </label>
      </header>

      {notice && <div className="toast" role="status">{notice}</div>}
      {displayedError && <div className="cycle-locked-note" role="alert">{displayedError}</div>}

      <div className="cycle-layout">
        <section aria-labelledby="deadline-form-title" className="cycle-form-panel">
          <div className="cycle-section-heading">
            <div>
              <h2 id="deadline-form-title">Evaluation deadlines</h2>
              <p>Times are shown in America/Chicago.</p>
            </div>
          </div>

          <div className="cycle-fields">
            <DeadlineField
              disabled={isLocked('signupDeadline')}
              error={errors.signupDeadline}
              helperText="Faculty must sign up before this time. Template changes after this cutoff apply next semester."
              id="signup-deadline"
              label="Sign-up deadline"
              onChange={(value) => updateDeadline('signupDeadline', value)}
              value={form.signupDeadline}
            />
            <DeadlineField
              disabled={isLocked('observationDeadline')}
              error={errors.observationDeadline}
              helperText="All observations must be completed before this time."
              id="observation-deadline"
              label="Observation deadline"
              onChange={(value) => updateDeadline('observationDeadline', value)}
              value={form.observationDeadline}
            />
            <DeadlineField
              disabled={isLocked('feedbackDeadline')}
              error={errors.feedbackDeadline}
              helperText="Faculty survey responses are due before this time."
              id="feedback-deadline"
              label="Feedback survey deadline"
              onChange={(value) => updateDeadline('feedbackDeadline', value)}
              value={form.feedbackDeadline}
            />
          </div>

          {selectedRecord.status === 'closed' && (
            <p className="cycle-locked-note">This cycle is closed. Historical deadlines cannot be edited.</p>
          )}

          <div className="cycle-form-actions">
            <button
              className="cycle-button cycle-button--secondary"
              disabled={!isDirty || isSaving}
              onClick={() => {
                setForm(serverForm)
                setErrors({})
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="cycle-button cycle-button--primary"
              disabled={!isDirty || !canEdit || isSaving}
              onClick={requestSave}
              type="button"
            >
              {isSaving ? 'Saving…' : 'Save deadlines'}
            </button>
          </div>
        </section>

        <CycleTimelinePreview
          deadlines={[
            { label: 'Sign-up closes', value: form.signupDeadline },
            { label: 'Observations due', value: form.observationDeadline },
            { label: 'Feedback due', value: form.feedbackDeadline },
          ]}
          status={selectedRecord.status}
        />
      </div>
    </section>
  )
}
