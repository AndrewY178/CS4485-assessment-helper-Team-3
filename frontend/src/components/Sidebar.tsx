import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getUnreadNotificationCount } from '../api/notifications'
import { useAuth, useLogout } from '../context/AuthContext'
import { AppLink, useNavigation } from '../context/NavigationContext'

const acNavItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Observation Template', to: '/template' },
  { label: 'Cycle Setup', to: '/cycle-setup' },
  { label: 'Sign-up Requests', to: '/sign-ups' },
  { label: 'Observer Selection', to: '/observer-selection' },
  { label: 'Observation Tracking', to: '/tracking' },
  { label: 'KPI Reports', to: '/cycle-kpi-report' },
]

const observerItems = [
  { label: 'Observe Others', to: '/observe-others' },
  { label: 'Observation Forms', to: '/observation-forms' },
]

const observeeItems = [
  { label: 'My Observer', to: '/my-observers' },
  { label: 'My Observation', to: '/my-observation' },
  { label: 'Survey', to: '/survey' },
]

interface FacultyGroupProps {
  id: string
  label: string
  items: typeof observerItems
  open: boolean
  onToggle: () => void
}

function FacultyGroup({
  id,
  label,
  items,
  open,
  onToggle,
}: FacultyGroupProps) {
  return (
    <div className="sidebar__nav-section">
      <button
        aria-controls={id}
        aria-expanded={open}
        className="sidebar__group-toggle"
        onClick={onToggle}
        type="button"
      >
        <span>{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`sidebar__group-chevron${open ? ' sidebar__group-chevron--open' : ''}`}
          size={15}
        />
      </button>

      {open && (
        <div className="sidebar__subnav" id={id}>
          {items.map(({ label: itemLabel, to }) => (
            <AppLink
              activeClassName="sidebar__link--active"
              className="sidebar__link sidebar__sublink"
              key={to}
              to={to}
            >
              {itemLabel}
            </AppLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { roles, token, canSwitchRoleForTesting, switchRoleForTesting } = useAuth()
  const logout = useLogout()
  const { navigate, pathname } = useNavigation()
  const isACMember = roles.includes('AC Member')
  const isFaculty = roles.includes('Faculty') && !isACMember
  const [observerOpen, setObserverOpen] = useState(true)
  const [observeeOpen, setObserveeOpen] = useState(true)
  const [unreadState, setUnreadState] = useState<{
    token: string | null
    count: number
  }>({ token: null, count: 0 })

  useEffect(() => {
    if (!token) return
    const activeToken = token

    let active = true
    async function refreshUnreadCount() {
      try {
        const result = await getUnreadNotificationCount(activeToken)
        if (active) setUnreadState({ token: activeToken, count: result.unreadCount })
      } catch (error) {
        if (active) {
          console.error('Unable to refresh unread notification count.', error)
        }
      }
    }

    function handleNotificationsRead() {
      void refreshUnreadCount()
    }

    void refreshUnreadCount()
    window.addEventListener('assessment-notifications-read', handleNotificationsRead)
    const intervalId = window.setInterval(() => {
      void refreshUnreadCount()
    }, 15000)

    return () => {
      active = false
      window.removeEventListener('assessment-notifications-read', handleNotificationsRead)
      window.clearInterval(intervalId)
    }
  }, [pathname, token])

  function messagesLabel() {
    const unreadCount = unreadState.token === token ? unreadState.count : 0
    return (
      <>
        <span>Messages</span>
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread messages`}
            className="sidebar__message-badge"
            role="status"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </>
    )
  }

  function handleRoleSwitch() {
    const nextRole = isACMember ? 'Faculty' : 'AC Member'
    switchRoleForTesting(nextRole)
    navigate(nextRole === 'AC Member' ? '/dashboard' : '/faculty/status')
  }

  return (
    <aside className="sidebar">
      <AppLink
        className="sidebar__brand"
        to={isACMember ? '/dashboard' : '/faculty/status'}
      >
        Assessment Helper
      </AppLink>

      <nav aria-label="Main navigation" className="sidebar__nav">
        {isACMember &&
          acNavItems.map(({ label, to }) => (
            <AppLink
              activeClassName="sidebar__link--active"
              className="sidebar__link"
              key={to}
              to={to}
            >
              {label}
            </AppLink>
          ))}

        {isACMember && (
          <AppLink
            activeClassName="sidebar__link--active"
            className="sidebar__link sidebar__messages-link"
            to="/messages"
          >
            {messagesLabel()}
          </AppLink>
        )}

        {isFaculty && (
          <>
            <AppLink
              activeClassName="sidebar__link--active"
              className="sidebar__link"
              to="/faculty/status"
            >
              My Status
            </AppLink>
            <AppLink
              activeClassName="sidebar__link--active"
              className="sidebar__link sidebar__messages-link"
              to="/messages"
            >
              {messagesLabel()}
            </AppLink>
            <AppLink
              activeClassName="sidebar__link--active"
              className="sidebar__link"
              to="/my-schedule"
            >
              My Schedule
            </AppLink>
            <FacultyGroup
              id="observer-navigation"
              items={observerItems}
              label="Observer"
              onToggle={() => setObserverOpen((current) => !current)}
              open={observerOpen}
            />
            <FacultyGroup
              id="observee-navigation"
              items={observeeItems}
              label="Observee"
              onToggle={() => setObserveeOpen((current) => !current)}
              open={observeeOpen}
            />
          </>
        )}
      </nav>

      <div className="sidebar__account">
        <span className="sidebar__role">
          {isACMember ? 'AC Member' : 'Faculty'}
        </span>
        {canSwitchRoleForTesting && (
          <button
            className="sidebar__role-switch"
            onClick={handleRoleSwitch}
            type="button"
          >
            Switch to {isACMember ? 'Faculty' : 'AC Member'}
          </button>
        )}
        <button className="sidebar__logout" onClick={logout} type="button">
          Log out
        </button>
      </div>
    </aside>
  )
}
