import { useEffect, useState } from 'react'
import CriteriaTable from '../../components/template/CriteriaTable'
import type { CriterionInput } from '../../components/template/CriterionEditor'
import ConfirmDialog from '../../components/template/ConfirmDialog'
import TemplatePreview from '../../components/template/TemplatePreview'
import { observationRatingScale } from '../../data/templateMockData'
import { getTemplate, getTemplates, saveTemplate } from '../../api/templates'
import { ApiError } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import type { ObservationTemplate, TemplateCriterion, TemplateSemesterSummary } from '../../types/template'
import '../../styles/template.css'

function copyTemplate(template: ObservationTemplate): ObservationTemplate {
  return {
    ...template,
    criteria: template.criteria.map((criterion) => ({ ...criterion })),
    ratingScale: template.ratingScale.map((rating) => ({ ...rating })),
  }
}

function normalizePositions(criteria: TemplateCriterion[]) {
  return criteria.map((criterion, index) => ({ ...criterion, position: index + 1 }))
}

function messageFor(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'Could not load the evaluation template. Please try again.'
}

export default function TemplatePage() {
  const { roles, token } = useAuth()
  const isACMember = roles.includes('AC Member')
  const [semesters, setSemesters] = useState<TemplateSemesterSummary[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [template, setTemplate] = useState<ObservationTemplate | null>(null)
  const [workingCopy, setWorkingCopy] = useState<ObservationTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateCriterion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token || !isACMember) {
      return
    }
    const controller = new AbortController()
    getTemplates(token, controller.signal)
      .then((response) => {
        setSemesters(response.semesters)
        setSelectedSemester((current) => current || response.semesters.find((item) => item.isEditable)?.semester || response.semesters[0]?.semester || '')
        setError('')
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(messageFor(loadError))
      })
      .finally(() => setLoadingList(false))
    return () => controller.abort()
  }, [token, isACMember])

  useEffect(() => {
    if (!token || !selectedSemester) return
    const controller = new AbortController()
    Promise.resolve().then(() => {
      setLoadingTemplate(true)
      return getTemplate(selectedSemester, token, controller.signal)
    })
      .then((response) => {
        setTemplate({ ...response.template, ratingScale: observationRatingScale })
        setWorkingCopy(null)
        setSemesters(response.semesters)
        setError('')
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(messageFor(loadError))
      })
      .finally(() => setLoadingTemplate(false))
    return () => controller.abort()
  }, [selectedSemester, token])

  const selectedTemplate = template?.effectiveSemester === selectedSemester ? template : null
  const displayedTemplate = workingCopy ?? selectedTemplate
  const isEditing = workingCopy !== null
  const canEdit = isACMember && Boolean(selectedTemplate?.isEditable)

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  function updateCriteria(updater: (criteria: TemplateCriterion[]) => TemplateCriterion[]) {
    setWorkingCopy((current) => current ? { ...current, criteria: normalizePositions(updater(current.criteria)) } : current)
  }

  function addCriterion(input: CriterionInput) {
    updateCriteria((criteria) => [
      ...criteria,
      { ...input, id: crypto.randomUUID(), position: criteria.length + 1 },
    ])
  }

  function editCriterion(id: string, input: CriterionInput) {
    updateCriteria((criteria) => criteria.map((criterion) => criterion.id === id ? { ...criterion, ...input } : criterion))
  }

  function moveCriterion(id: string, direction: -1 | 1) {
    updateCriteria((criteria) => {
      const fromIndex = criteria.findIndex((criterion) => criterion.id === id)
      const toIndex = fromIndex + direction
      if (fromIndex < 0 || toIndex < 0 || toIndex >= criteria.length) return criteria
      const reordered = [...criteria]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      return reordered
    })
  }

  async function saveDraft() {
    if (!workingCopy || !token || !selectedSemester) return
    if (workingCopy.criteria.length === 0) {
      showNotice('Add at least one criterion before saving a template.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await saveTemplate(selectedSemester, workingCopy.criteria, token)
      const saved = { ...response.template, ratingScale: observationRatingScale }
      setTemplate(saved)
      setSemesters((current) => current.map((item) => item.semester === selectedSemester
        ? { ...item, version: saved.version, status: saved.status === 'current' ? 'published' : 'draft' }
        : item))
      setWorkingCopy(null)
      showNotice(`Version ${saved.version} saved.`)
    } catch (saveError) {
      setError(messageFor(saveError))
    } finally {
      setSaving(false)
    }
  }

  if (!isACMember) {
    return (
      <section className="template-page">
        <h1>Observation template</h1>
        <p>Only Assessment Committee members can view evaluation templates.</p>
      </section>
    )
  }

  return (
    <section className="template-page">
      <header className="template-page__header">
        <div>
          <h1>Observation template</h1>
          <p>
            {isEditing
              ? `Editing ${selectedSemester} · new version`
              : selectedTemplate?.version
                ? `${selectedSemester} · version ${selectedTemplate.version}`
                : `${selectedSemester || 'Select a semester'} · draft`}
          </p>
        </div>
        <div className="template-page__header-actions">
          {semesters.length > 0 && (
            <label className="template-semester-select" htmlFor="template-semester">
              <span>Semester</span>
              <select id="template-semester" onChange={(event) => setSelectedSemester(event.target.value)} value={selectedSemester}>
                {semesters.map((item) => (
                  <option key={item.semester} value={item.semester}>
                    {item.semester}{item.isEditable ? ' · editable' : ' · view only'}
                  </option>
                ))}
              </select>
            </label>
          )}
          {displayedTemplate && <button className="template-link-button" onClick={() => setPreviewOpen(true)} type="button">Preview form</button>}
          {canEdit && !isEditing && !loadingTemplate && (
            <button className="template-link-button" onClick={() => setWorkingCopy(copyTemplate(template!))} type="button">Edit template</button>
          )}
          {isEditing && (
            <>
              <button className="template-button template-button--secondary" disabled={saving} onClick={() => setWorkingCopy(null)} type="button">Cancel</button>
              <button className="template-button template-button--primary" disabled={saving} onClick={() => void saveDraft()} type="button">
                {saving ? 'Saving…' : 'Save new version'}
              </button>
            </>
          )}
        </div>
      </header>

      {notice && <div className="toast" role="status">{notice}</div>}
      {error && <div className="template-error" role="alert">{error}</div>}
      {(loadingList || loadingTemplate) && <p role="status">Loading evaluation template…</p>}
      {!loadingList && semesters.length === 0 && !error && <p>No evaluation cycles or template versions are available.</p>}
      {selectedTemplate && !selectedTemplate.isEditable && (
        <p className="template-session-note">This semester’s template is read-only. Templates lock when the signup deadline passes.</p>
      )}
      {selectedTemplate?.isInheritedDraft && selectedTemplate.isEditable && (
        <p className="template-session-note">This is a draft copied from the latest saved template. Saving creates a new version for {selectedSemester}.</p>
      )}

      {displayedTemplate && (
        <div className="template-editor-layout">
          <CriteriaTable
            criteria={displayedTemplate.criteria}
            editable={isEditing}
            onAdd={addCriterion}
            onEdit={editCriterion}
            onMove={moveCriterion}
            onRemove={setDeleteTarget}
          />
          <aside className="rating-scale" aria-labelledby="rating-scale-title">
            <h2 id="rating-scale-title">Rating scale:</h2>
            <ol>
              {displayedTemplate.ratingScale.map((rating) => (
                <li key={rating.value}><span>{rating.value}</span> {rating.label}</li>
              ))}
              <li><span>N/A</span> Not applicable</li>
            </ol>
            <p>Changes apply to the selected semester. Previously saved evaluation versions remain unchanged.</p>
          </aside>
        </div>
      )}

      {deleteTarget && isEditing && (
        <ConfirmDialog
          criterionName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            updateCriteria((criteria) => criteria.filter((criterion) => criterion.id !== deleteTarget.id))
            setDeleteTarget(null)
            showNotice('Criterion removed from the working draft.')
          }}
        />
      )}
      {previewOpen && displayedTemplate && (
        <TemplatePreview
          label={isEditing ? 'Unsaved working copy' : selectedTemplate?.version ? `${selectedSemester} · version ${selectedTemplate.version}` : `${selectedSemester} · draft`}
          onClose={() => setPreviewOpen(false)}
          template={displayedTemplate}
        />
      )}
    </section>
  )
}
