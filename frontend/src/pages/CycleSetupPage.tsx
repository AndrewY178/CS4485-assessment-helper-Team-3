import { useMemo, useState } from 'react'
import ConfirmDeadlineChangeDialog from '../components/cycle/ConfirmDeadlineChangeDialog'
import CycleTimelinePreview from '../components/cycle/CycleTimelinePreview'
import DeadlineField from '../components/cycle/DeadlineField'
import { useAuth } from '../context/AuthContext'
import { initialCycleRecords, type MockCycleRecord } from '../data/cycleMockData'
import type { SaveEvaluationCycleRequest } from '../types/api'
import '../styles/cycle-setup.css'

type DeadlineKey = keyof SaveEvaluationCycleRequest
type DeadlineErrors = Partial<Record<DeadlineKey, string>>

function toLocalInputValue(isoValue: string) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function cycleToForm(record: MockCycleRecord): SaveEvaluationCycleRequest {
  return {
    signupDeadline: toLocalInputValue(record.cycle.signupDeadline),
    observationDeadline: toLocalInputValue(record.cycle.observationDeadline),
    feedbackDeadline: toLocalInputValue(record.cycle.feedbackDeadline),
  }
}

function validateDeadlines(values: SaveEvaluationCycleRequest) {
  const errors: DeadlineErrors = {}
  const entries: Array<[DeadlineKey, string]> = [
    ['signupDeadline', values.signupDeadline],
    ['observationDeadline', values.observationDeadline],
    ['feedbackDeadline', values.feedbackDeadline],
  ]

  entries.forEach(([key, value]) => {
    if (!value) errors[key] = 'Select a date and time.'
    else if (Number.isNaN(new Date(value).getTime())) errors[key] = 'Enter a valid date and time.'
  })

  if (Object.keys(errors).length > 0) return errors

  const signup = new Date(values.signupDeadline)
  const observation = new Date(values.observationDeadline)
  const feedback = new Date(values.feedbackDeadline)

  if (signup >= observation) {
    errors.observationDeadline = 'Observation deadline must occur after sign-up closes.'
  }
  if (observation >= feedback) {
    errors.feedbackDeadline = 'Feedback deadline must occur after the observation deadline.'
  }

  return errors
}

export default function CycleSetupPage() {
  const { roles } = useAuth()
  const [records, setRecords] = useState(initialCycleRecords)
  const [selectedSemesterId, setSelectedSemesterId] = useState(records[0].cycle.semesterId)
  const selectedRecord = records.find((record) => record.cycle.semesterId === selectedSemesterId) ?? records[0]
  const [form, setForm] = useState<SaveEvaluationCycleRequest>(() => cycleToForm(selectedRecord))
  const [errors, setErrors] = useState<DeadlineErrors>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const savedForm = useMemo(() => cycleToForm(selectedRecord), [selectedRecord])
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)
  const isACMember = roles.includes('AC Member')
  const canEdit = isACMember && selectedRecord.cycle.status !== 'closed'

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  function selectSemester(semesterId: string) {
    const nextRecord = records.find((record) => record.cycle.semesterId === semesterId)
    if (!nextRecord) return
    setSelectedSemesterId(semesterId)
    setForm(cycleToForm(nextRecord))
    setErrors({})
  }

  function updateDeadline(key: DeadlineKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function isLocked(key: DeadlineKey) {
    const status = selectedRecord.cycle.status
    if (!canEdit) return true
    if (status === 'observation') return key === 'signupDeadline'
    if (status === 'feedback') return key !== 'feedbackDeadline'
    return false
  }

  function requestSave() {
    const nextErrors = validateDeadlines(form)
    ;(['signupDeadline', 'observationDeadline', 'feedbackDeadline'] as DeadlineKey[]).forEach((key) => {
      if (!isLocked(key) && form[key] && new Date(form[key]) <= new Date()) {
        nextErrors[key] = 'Deadline must be in the future.'
      }
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (selectedRecord.hasActivity) setConfirmOpen(true)
    else commitSave()
  }

  function commitSave() {
    // TODO(API): PUT /api/schedule/{semesterId} with these UTC fields and only
    // update the UI after Flask returns EvaluationCycleResponse successfully.
    setRecords((current) => current.map((record) => (
      record.cycle.semesterId === selectedSemesterId
        ? {
            ...record,
            cycle: {
              ...record.cycle,
              signupDeadline: new Date(form.signupDeadline).toISOString(),
              observationDeadline: new Date(form.observationDeadline).toISOString(),
              feedbackDeadline: new Date(form.feedbackDeadline).toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }
        : record
    )))
    setConfirmOpen(false)
    showNotice('Cycle draft saved for this session. It will be lost on refresh.')
  }

  if (!isACMember) {
    return (
      <section className="cycle-access-denied">
        <h1>Cycle setup</h1>
        <p>Only Assessment Committee members can configure evaluation cycles.</p>
      </section>
    )
  }

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
            id="cycle-semester"
            onChange={(event) => selectSemester(event.target.value)}
            value={selectedSemesterId}
          >
            {records.map((record) => (
              <option key={record.cycle.semesterId} value={record.cycle.semesterId}>
                {record.cycle.semesterLabel}
              </option>
            ))}
          </select>
        </label>
      </header>

      {notice && <div className="toast" role="status">{notice}</div>}

      <p className="cycle-session-note">
        Prototype only: deadline changes are stored in React state and are not saved to Flask or MySQL.
      </p>

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
              helperText="Faculty feedback surveys close at this time."
              id="feedback-deadline"
              label="Feedback survey deadline"
              onChange={(value) => updateDeadline('feedbackDeadline', value)}
              value={form.feedbackDeadline}
            />
          </div>

          {selectedRecord.cycle.status === 'closed' && (
            <p className="cycle-locked-note">This cycle is closed. Historical deadlines cannot be edited.</p>
          )}

          <div className="cycle-form-actions">
            <button
              className="cycle-button cycle-button--secondary"
              disabled={!isDirty}
              onClick={() => {
                setForm(savedForm)
                setErrors({})
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="cycle-button cycle-button--primary"
              disabled={!isDirty || !canEdit}
              onClick={requestSave}
              type="button"
            >
              Save deadlines
            </button>
          </div>
        </section>

        <CycleTimelinePreview
          deadlines={[
            { label: 'Sign-up closes', value: form.signupDeadline },
            { label: 'Observations due', value: form.observationDeadline },
            { label: 'Feedback due', value: form.feedbackDeadline },
          ]}
          status={selectedRecord.cycle.status}
        />
      </div>

      {confirmOpen && (
        <ConfirmDeadlineChangeDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={commitSave}
        />
      )}
    </section>
  )
}
