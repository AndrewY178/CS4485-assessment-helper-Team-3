import { useState } from 'react'
import CriteriaTable from '../components/template/CriteriaTable'
import type { CriterionInput } from '../components/template/CriterionEditor'
import ConfirmDialog from '../components/template/ConfirmDialog'
import TemplatePreview from '../components/template/TemplatePreview'
import { useAuth } from '../context/AuthContext'
import { currentObservationTemplate } from '../data/templateMockData'
import type { ObservationTemplate, TemplateCriterion } from '../types/template'
import '../styles/template.css'

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

export default function TemplatePage() {
  const { role } = useAuth()
  const canEdit = role === 'AC Member'
  const [draft, setDraft] = useState<ObservationTemplate | null>(null)
  const [workingCopy, setWorkingCopy] = useState<ObservationTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateCriterion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const displayedTemplate = canEdit && draft ? draft : currentObservationTemplate
  const previewTemplate = workingCopy ?? displayedTemplate
  const isEditing = workingCopy !== null

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  function startEditing() {
    const source = draft ?? {
      ...currentObservationTemplate,
      id: 'observation-template-v3-draft',
      version: 3,
      status: 'draft' as const,
    }
    setWorkingCopy(copyTemplate(source))
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

  function saveDraft() {
    if (!workingCopy) return
    if (workingCopy.criteria.length === 0) {
      showNotice('Add at least one criterion before saving a draft.')
      return
    }
    setDraft(copyTemplate(workingCopy))
    setWorkingCopy(null)
    showNotice('Draft saved in this browser session. It will be lost on refresh.')
  }

  return (
    <section className="template-page">
      <header className="template-page__header">
        <div>
          <h1>Observation template</h1>
          <p>
            {isEditing
              ? 'Editing version 3 · draft'
              : draft && canEdit
                ? 'Version 3 · draft saved temporarily'
                : `Current version ${currentObservationTemplate.version}`}
          </p>
        </div>
        <div className="template-page__header-actions">
          <button className="template-link-button" onClick={() => setPreviewOpen(true)} type="button">Preview form</button>
          {canEdit && !isEditing && (
            <button className="template-link-button" onClick={startEditing} type="button">Edit template</button>
          )}
          {isEditing && (
            <>
              <button className="template-button template-button--secondary" onClick={() => setWorkingCopy(null)} type="button">Cancel</button>
              <button className="template-button template-button--primary" onClick={saveDraft} type="button">Save draft</button>
            </>
          )}
          {canEdit && (
            <button
              className="template-publish-button"
              onClick={() => showNotice('Publishing requires backend integration. No template was activated.')}
              type="button"
            >
              Publish version 3
            </button>
          )}
        </div>
      </header>

      {notice && <div className="toast" role="status">{notice}</div>}

      {canEdit && (
        <p className="template-session-note">
          Draft changes are temporary and will be lost on refresh until backend persistence is implemented.
        </p>
      )}

      <div className="template-editor-layout">
        <CriteriaTable
          criteria={previewTemplate.criteria}
          editable={isEditing}
          onAdd={addCriterion}
          onEdit={editCriterion}
          onMove={moveCriterion}
          onRemove={setDeleteTarget}
        />

        <aside className="rating-scale" aria-labelledby="rating-scale-title">
          <h2 id="rating-scale-title">Rating scale:</h2>
          <ol>
            {previewTemplate.ratingScale.map((rating) => (
              <li key={rating.value}><span>{rating.value}</span> {rating.label}</li>
            ))}
            <li><span>N/A</span> Not applicable</li>
          </ol>
          <p>
            Changes take effect only in the following semester. Previously signed observation reports keep their original template version and remain unchanged.
          </p>
        </aside>
      </div>

      {deleteTarget && (
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
      {previewOpen && (
        <TemplatePreview
          label={workingCopy ? 'Unsaved working copy' : draft && canEdit ? 'Temporary draft · version 3' : `Current version ${currentObservationTemplate.version}`}
          onClose={() => setPreviewOpen(false)}
          template={previewTemplate}
        />
      )}
    </section>
  )
}
