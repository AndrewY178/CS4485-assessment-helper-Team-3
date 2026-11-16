import { useEffect, useRef, useState } from 'react'
import AlertPanel from '../../components/AlertPanel'
import HireLevelTable from '../../components/HireLevelTable'
import { MailIcon } from '../../components/Icons'
import StatCard from '../../components/StatCard'
import Stepper from '../../components/Stepper'
import { ApiError } from '../../api/auth'
import { getCycleDeadline } from '../../api/cycles'
import { getDashboard } from '../../api/dashboard'
import { getKpis } from '../../api/kpis'
import { getNoObserverObservees, getObservees, getUncompletedObservees } from '../../api/observees'
import { generateObserverLists } from '../../api/observers'
import { sendSignUpReminders } from '../../api/reminders'
import type { Stat } from '../../data/mockData'
import type {
  CycleDeadlineResponse,
  CycleKpis,
  DashboardAlert,
  DashboardResponse,
  DashboardStep,
  ObserveeResponse,
  UncompletedObservee,
} from '../../types/api'
import { useAuth } from '../../context/AuthContext'

function deadlineLabel(value: string) {
  const parsed = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function withDeadlines(steps: DashboardStep[], deadline: CycleDeadlineResponse | null) {
  if (!deadline) return steps
  return steps.map((step) => {
    if (step.title === 'Sign-up') {
      return { ...step, date: deadlineLabel(deadline.signup_deadline) }
    }
    if (step.title === 'Observation' && deadline.observation_deadline) {
      return { ...step, date: deadlineLabel(deadline.observation_deadline) }
    }
    return step
  })
}

function openCounts(rows: UncompletedObservee[]) {
  let due = 0
  let overdue = 0
  for (const row of rows) {
    if (!row.uncompleted) continue
    if (row.meeting_date) overdue += 1
    else due += 1
  }
  return { due, overdue }
}

function missingObserverAlerts(
  missing: Array<{ observee_id: number }>,
  observees: ObserveeResponse[],
): DashboardAlert[] {
  return missing.map((row) => {
    const person = observees.find((item) => String(item.id) === String(row.observee_id))
    const course = [person?.course_department, person?.course_number].filter(Boolean).join(' ')
    return {
      professorName: person?.name || '—',
      course: course || null,
      courseDay: person?.course_day ?? null,
      courseStartTime: person?.course_start_time ?? null,
      courseEndTime: person?.course_end_time ?? null,
    }
  })
}

function dashboardStats(
  cycle: CycleKpis | undefined,
  uncompleted: UncompletedObservee[] | null,
): Stat[] {
  const open = uncompleted ? openCounts(uncompleted) : null
  if (!cycle) {
    return [
      { label: 'Due this semester', value: open ? String(open.due) : '—', caption: 'Signed up and not completed' },
      { label: 'Overdue', value: open ? String(open.overdue) : '—', caption: 'Meeting date has passed with no report' },
      { label: 'Signed up', value: '—', caption: 'Faculty still to sign up' },
      { label: 'Unmatched faculty', value: '—', caption: 'Observer assignment needed' },
    ]
  }

  const remaining = Math.max(cycle.due - cycle.signedUp, 0)
  return [
    {
      label: 'Due this semester',
      value: open ? String(open.due) : '—',
      caption: 'Signed up and not completed',
    },
    {
      label: 'Overdue',
      value: open ? String(open.overdue) : '—',
      caption: 'Meeting date has passed with no report',
    },
    {
      label: 'Signed up',
      value: `${cycle.signedUp} of ${cycle.due}`,
      caption: remaining === 1 ? '1 faculty member still to sign up' : `${remaining} faculty still to sign up`,
    },
    {
      label: 'Unmatched faculty',
      value: String(cycle.unmatched),
      caption: 'Observer assignment needed',
      warning: cycle.unmatched > 0,
    },
  ]
}

export default function DashboardPage() {
  const { roles, token } = useAuth()
  const isAcMember = roles.includes('AC Member')
  const [notice, setNotice] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendingReminders, setSendingReminders] = useState(false)
  const [kpiCycle, setKpiCycle] = useState<CycleKpis | undefined>(undefined)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [deadline, setDeadline] = useState<CycleDeadlineResponse | null>(null)
  const [uncompleted, setUncompleted] = useState<UncompletedObservee[] | null>(null)
  const [observerAlerts, setObserverAlerts] = useState<DashboardAlert[]>([])
  const [runningSelection, setRunningSelection] = useState(false)
  const noticeTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    getKpis(token, controller.signal)
      .then(async (response) => {
        if (controller.signal.aborted) return
        const cycle = response.cycles[0]
        setKpiCycle(cycle)
        if (!cycle) return
        try {
          const [uncompletedRows, missing, observees] = await Promise.all([
            getUncompletedObservees(cycle.cycle, token, controller.signal),
            getNoObserverObservees(cycle.cycle, token, controller.signal),
            getObservees(cycle.cycle),
          ])
          if (controller.signal.aborted) return
          setUncompleted(uncompletedRows)
          setObserverAlerts(missingObserverAlerts(missing, observees))
          try {
            const storedDeadline = await getCycleDeadline(cycle.cycle, controller.signal)
            if (!controller.signal.aborted) setDeadline(storedDeadline)
          } catch (error) {
            if (controller.signal.aborted) return
            if (!(error instanceof ApiError && error.status === 404)) throw error
            setDeadline(null)
          }
        } catch (error) {
          if (controller.signal.aborted) return
          setSendError(error instanceof Error ? error.message : 'Unable to load cycle details.')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setKpiCycle(undefined)
      })
    getDashboard(token, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setDashboard(response)
      })
      .catch(() => {
        if (!controller.signal.aborted) setDashboard(null)
      })

    return () => controller.abort()
  }, [token])

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

  async function handleRunSelection() {
    const cycle = dashboard?.cycle ?? kpiCycle?.cycle
    if (!cycle) {
      showNotice('No sign-up cycle was found.')
      return
    }

    setRunningSelection(true)
    setSendError('')
    try {
      const result = await generateObserverLists(cycle)
      if (token) {
        const [kpis, nextDashboard] = await Promise.all([
          getKpis(token),
          getDashboard(token),
        ])
        const cycle = kpis.cycles[0]
        setKpiCycle(cycle)
        setDashboard(nextDashboard)
        if (cycle) {
          const [uncompletedRows, missing, observees, storedDeadline] = await Promise.all([
            getUncompletedObservees(cycle.cycle, token),
            getNoObserverObservees(cycle.cycle, token),
            getObservees(cycle.cycle),
            getCycleDeadline(cycle.cycle).catch((error: unknown) => {
              if (error instanceof ApiError && error.status === 404) return null
              throw error
            }),
          ])
          setUncompleted(uncompletedRows)
          setObserverAlerts(missingObserverAlerts(missing, observees))
          setDeadline(storedDeadline)
        }
      }
      showNotice(
        `Observer lists generated for ${result.generated} of ${result.total_observees} sign-ups.`,
        5000,
      )
    } catch (error) {
      setSendError(
        error instanceof ApiError
          ? error.message
          : 'Unable to run observer selection.',
      )
    } finally {
      setRunningSelection(false)
    }
  }

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
            disabled={runningSelection}
            onClick={() => void handleRunSelection()}
            type="button"
          >
            {runningSelection ? 'Running observer selection...' : 'Run observer selection'}
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
        <Stepper steps={withDeadlines(dashboard?.steps ?? [], deadline)} />
      </section>

      <section aria-label="Observation summary" className="stats-grid">
        {dashboardStats(kpiCycle, uncompleted).map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <div className="dashboard-bottom">
        <HireLevelTable rows={dashboard?.hireLevels ?? []} />
        <AlertPanel alerts={observerAlerts} />
      </div>
    </div>
  )
}
