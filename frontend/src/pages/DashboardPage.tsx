import { useState } from 'react'
import AlertPanel from '../components/AlertPanel'
import HireLevelTable from '../components/HireLevelTable'
import { MailIcon } from '../components/Icons'
import StatCard from '../components/StatCard'
import Stepper from '../components/Stepper'
import { stats } from '../data/mockData'

export default function DashboardPage() {
  const [notice, setNotice] = useState('')

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Executive dashboard</h1>
        <div className="dashboard-header__actions">
          <button
            className="button button--text"
            onClick={() => showNotice('Reminders are ready to send.')}
            type="button"
          >
            <MailIcon className="button__icon" />
            Send reminders
          </button>
          <button
            className="button button--primary"
            onClick={() => showNotice('Observer selection started.')}
            type="button"
          >
            Run observer selection
          </button>
        </div>
      </header>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      <section aria-label="Cycle timeline" className="dashboard-section">
        <Stepper />
      </section>

      <section aria-label="Observation summary" className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <div className="dashboard-bottom">
        <HireLevelTable />
        <AlertPanel />
      </div>
    </div>
  )
}
