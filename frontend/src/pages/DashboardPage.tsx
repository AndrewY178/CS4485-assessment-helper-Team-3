import { useState } from 'react'
import AlertPanel from '../components/AlertPanel'
import HireLevelTable from '../components/HireLevelTable'
import { MailIcon } from '../components/Icons'
import StatCard from '../components/StatCard'
import Stepper from '../components/Stepper'
import { sendSignUpReminders } from '../api/reminders'
import { stats } from '../data/mockData'

export default function DashboardPage() {
  const [notice, setNotice] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendingReminders, setSendingReminders] = useState(false)

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  async function handleSendReminders() {
    setNotice('')
    setSendError('')
    setSendingReminders(true)

    try {
      const result = await sendSignUpReminders()
      setNotice(
        result.testMode
          ? `Test email sent. In production, ${result.recipientCount} faculty would receive individual reminders.`
          : `${result.sentCount} sign-up reminders sent.`,
      )
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : 'Unable to send reminders. Please try again.',
      )
    } finally {
      setSendingReminders(false)
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Executive dashboard</h1>
        <div className="dashboard-header__actions">
          <button
            className="button button--text"
            disabled={sendingReminders}
            onClick={() => void handleSendReminders()}
            type="button"
          >
            <MailIcon className="button__icon" />
            {sendingReminders ? 'Sending reminders...' : 'Send reminders'}
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
      {sendError && (
        <div className="toast toast--error" role="alert">
          {sendError}
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
