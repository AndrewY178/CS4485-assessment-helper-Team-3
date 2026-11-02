import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth, useLogout } from '../context/AuthContext'
import { AppLink, useNavigation } from '../context/NavigationContext'

const acNavItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Observation Template', to: '/template' },
  { label: 'Cycle Setup', to: '/cycle-setup' },
  { label: 'Sign-up Requests', to: '/sign-ups' },
  { label: 'Observer Selection', to: '/observer-selection' },
  { label: 'Observation Tracking', to: '/tracking' },
  { label: 'KPI Reports', to: '/kpi-reports' },
]

const observerNavItems = [
  { label: 'Observe Others', to: '/faculty/observe-others' },
  { label: 'My Schedule', to: '/faculty/schedule' },
]

const observeeNavItems = [
  { label: 'My Observer', to: '/faculty/observer' },
  { label: 'My Observation', to: '/faculty/observation' },
  { label: 'Survey', to: '/faculty/survey' },
]

interface FacultyNavGroupProps {
  id: string
  label: string
  items: typeof observerNavItems
  open: boolean
  onToggle: () => void
}

function FacultyNavGroup({
  id,
  label,
  items,
  open,
  onToggle,
}: FacultyNavGroupProps) {
  const { pathname } = useNavigation()
  const containsActivePage = items.some((item) => item.to === pathname)

  return (
    <div className="sidebar__nav-section">
      <button
        aria-controls={id}
        aria-expanded={open}
        className={`sidebar__group-toggle${containsActivePage ? ' sidebar__group-toggle--active' : ''}`}
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
  const { roles } = useAuth()
  const { pathname } = useNavigation()
  const logout = useLogout()
  const isFacultyWorkspace = pathname.startsWith('/faculty/')
  const isACMember = roles.includes('AC Member')
  const hasFacultyAccess = roles.includes('Faculty') || isACMember
  const [observerOpen, setObserverOpen] = useState(true)
  const [observeeOpen, setObserveeOpen] = useState(true)
  const homePath = isFacultyWorkspace ? '/faculty/status' : '/dashboard'

  return (
    <aside className="sidebar">
      <AppLink className="sidebar__brand" to={homePath}>
        Assessment Helper
      </AppLink>

      <nav aria-label="Main navigation" className="sidebar__nav">
        {isFacultyWorkspace ? (
          <>
            <AppLink
              activeClassName="sidebar__link--active"
              className="sidebar__link"
              to="/faculty/status"
            >
              My Status
            </AppLink>

            <FacultyNavGroup
              id="observer-navigation"
              items={observerNavItems}
              label="Observer"
              onToggle={() => setObserverOpen((current) => !current)}
              open={observerOpen}
            />
            <FacultyNavGroup
              id="observee-navigation"
              items={observeeNavItems}
              label="Observee"
              onToggle={() => setObserveeOpen((current) => !current)}
              open={observeeOpen}
            />

            {isACMember && (
              <AppLink
                className="sidebar__link sidebar__workspace-switch"
                to="/dashboard"
              >
                Return to AC Workspace
              </AppLink>
            )}
          </>
        ) : (
          <>
            {acNavItems.map(({ label, to }) => (
              <AppLink
                activeClassName="sidebar__link--active"
                className="sidebar__link"
                key={to}
                to={to}
              >
                {label}
              </AppLink>
            ))}

            {hasFacultyAccess && (
              <AppLink
                className="sidebar__link sidebar__workspace-switch"
                to="/faculty/status"
              >
                Faculty Workspace
              </AppLink>
            )}
          </>
        )}
      </nav>

      <div className="sidebar__account">
        <span className="sidebar__role">{roles.join(' · ')}</span>
        <button className="sidebar__logout" onClick={logout} type="button">
          Log out
        </button>
      </div>
    </aside>
  )
}
