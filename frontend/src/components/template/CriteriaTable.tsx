import { useState } from 'react'
import type { TemplateCriterion } from '../../types/template'
import CriterionEditor, { type CriterionInput } from './CriterionEditor'

interface CriteriaTableProps {
  criteria: TemplateCriterion[]
  editable: boolean
  onAdd: (input: CriterionInput) => void
  onEdit: (id: string, input: CriterionInput) => void
  onMove: (id: string, direction: -1 | 1) => void
  onRemove: (criterion: TemplateCriterion) => void
}

export default function CriteriaTable({
  criteria,
  editable,
  onAdd,
  onEdit,
  onMove,
  onRemove,
}: CriteriaTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <div className="criteria-table-wrap">
      <table className="criteria-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Criterion</th>
            <th scope="col">Type</th>
            <th scope="col">Weight</th>
            <th scope="col">Required</th>
            {editable && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {criteria.length === 0 && !adding && (
            <tr>
              <td className="template-empty" colSpan={editable ? 6 : 5}>No criteria have been added yet.</td>
            </tr>
          )}
          {criteria.map((criterion, index) => (
            <tr className="criteria-table__row" key={criterion.id}>
              {editingId === criterion.id ? (
                <td className="criteria-table__editor" colSpan={6}>
                  <CriterionEditor
                    criterion={criterion}
                    existingNames={criteria.filter((item) => item.id !== criterion.id).map((item) => item.name)}
                    onCancel={() => setEditingId(null)}
                    onSave={(input) => {
                      onEdit(criterion.id, input)
                      setEditingId(null)
                    }}
                  />
                </td>
              ) : (
                <>
                  <td>{index + 1}</td>
                  <th scope="row">
                    <span className="criteria-table__name">{criterion.name}</span>
                    <span className="criteria-table__description">{criterion.description}</span>
                  </th>
                  <td>{criterion.type}</td>
                  <td>{criterion.weight ?? '—'}</td>
                  <td>{criterion.required ? 'Yes' : 'No'}</td>
                  {editable && (
                    <td>
                      <div className="criteria-table__actions">
                        <button aria-label={`Move ${criterion.name} up`} className="template-icon-button" disabled={index === 0} onClick={() => onMove(criterion.id, -1)} type="button">
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button aria-label={`Move ${criterion.name} down`} className="template-icon-button" disabled={index === criteria.length - 1} onClick={() => onMove(criterion.id, 1)} type="button">
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button className="template-link-button" onClick={() => setEditingId(criterion.id)} type="button">Edit</button>
                        <button className="template-link-button" onClick={() => onRemove(criterion)} type="button">Remove</button>
                      </div>
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
          {adding && (
            <tr>
              <td className="criteria-table__editor" colSpan={6}>
                <CriterionEditor
                  existingNames={criteria.map((criterion) => criterion.name)}
                  onCancel={() => setAdding(false)}
                  onSave={(input) => {
                    onAdd(input)
                    setAdding(false)
                  }}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editable && !adding && (
        <button className="template-add-button" onClick={() => setAdding(true)} type="button">+ Add criterion</button>
      )}
    </div>
  )
}
