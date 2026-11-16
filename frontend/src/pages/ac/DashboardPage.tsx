import { useEffect, useRef, useState } from 'react'
import AlertPanel from '../../components/AlertPanel'
import HireLevelTable from '../../components/HireLevelTable'
import { MailIcon } from '../../components/Icons'
import StatCard from '../../components/StatCard'
import Stepper from '../../components/Stepper'
import { sendSignUpReminders } from '../../api/reminders'
import { stats } from '../../data/mockData'
import { useAuth } from '../../context/AuthContext'

export default function DashboardPage() {
  const { roles, token } = useAuth()
  const isAcMember = roles.includes('AC Member')
  const [notice, setNotice] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendingReminders, setSendingReminders] = useState(false)
  const noticeTimeout = useRef<number | undefined>(undefined)

  function showNotice(message: string, duration = 3200) {
    if (noticeTimeout.current !== undefined) {
      window.clearTimeout(noticeTimeout.current)
    }
    setNotice(message)
    noticeTimeout.current = window.setTimeout(() => {
      setNotice('')
      noticeTimeout.current = undefined
    }, duration)
  }

  useEffect(
    () => () => {
      if (noticeTimeout.current !== undefined) {
        window.clearTimeout(noticeTimeout.current)
      }
    },
    [],
  )

  async function handleSendReminders() {
    setNotice('')
    setSendError('')
    setSendingReminders(true)

    try {
      if (!token) {
        throw new Error('Your session expired. Please log in again.')
      }
      const result = await sendSignUpReminders(token)
      showNotice(
        result.recipientCount === 0
          ? 'No due or overdue evaluations were found.'
          : `Created ${result.notificationCount} in-app notification${result.notificationCount === 1 ? '' : 's'} for ${result.recipientCount} faculty member${result.recipientCount === 1 ? '' : 's'} and sent ${result.sentCount} ${result.testMode ? 'test email' : 'email reminder'}${result.sentCount === 1 ? '' : 's'}${result.testMode ? ' to the test inbox' : ''}.`,
        5000,
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
          {isAcMember && (
            <button
              className="button button--text"
              disabled={sendingReminders}
              onClick={() => void handleSendReminders()}
              type="button"
            >
              <MailIcon className="button__icon" />
              {sendingReminders ? 'Sending reminders...' : 'Send reminders'}
            </button>
          )}
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
