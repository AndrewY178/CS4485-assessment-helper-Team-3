import { AppLink } from '../context/NavigationContext'
import { AlertTriangleIcon } from './Icons'

export default function AlertPanel() {
  return (
    <aside aria-label="Observation notes" className="alert-panels">
      <section className="alert-panel" aria-labelledby="eligible-observers">
        <h2 className="alert-panel__title" id="eligible-observers">
          <AlertTriangleIcon className="alert-panel__icon" />
          No eligible observers
        </h2>
        <p>Dr. Maya Chen · CS 4349 · TR 10:00</p>
        <p>Dr. Omar Haddad · CS 6360 · MW 4:00</p>
        <AppLink className="text-link" to="/observer-selection">
          Review in observer selection
        </AppLink>
      </section>

      <section className="alert-panel" aria-labelledby="template-title">
        <h2 className="alert-panel__title" id="template-title">
          Observation template
        </h2>
        <p>
          8 criteria · 1–5 rating scale. Only AC members can edit. Signed
          observations never change.
        </p>
        <AppLink className="text-link" to="/template">
          Edit template
        </AppLink>
      </section>
    </aside>
  )
}
