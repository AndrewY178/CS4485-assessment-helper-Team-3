import { useAuth, useLogout } from '../context/AuthContext'
import { AppLink } from '../context/NavigationContext'

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Template', to: '/template' },
  { label: 'Cycle Setup', to: '/cycle-setup' },
  { label: 'Sign-ups', to: '/sign-ups' },
  { label: 'Observer Selection', to: '/observer-selection' },
  { label: 'Tracking', to: '/tracking' },
  { label: 'Cycle KPI report', to: '/cycle-kpi-report' },
]

export default function Sidebar() {
  const { roles } = useAuth()
  const logout = useLogout()
  const visibleNavItems = roles.length > 0 ? navItems : []

  return (
    <aside className="sidebar">
      <AppLink className="sidebar__brand" to="/dashboard">
        Assessment Helper
      </AppLink>

      <nav aria-label="Main navigation" className="sidebar__nav">
        {visibleNavItems.map(({ label, to }) => (
          <AppLink
            activeClassName="sidebar__link--active"
            className="sidebar__link"
            key={to}
            to={to}
          >
            {label}
          </AppLink>
        ))}
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
