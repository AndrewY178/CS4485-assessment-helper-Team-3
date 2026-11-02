import { useEffect } from 'react'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useNavigation } from './context/NavigationContext'
import DashboardPage from './pages/DashboardPage'
import CycleSetupPage from './pages/CycleSetupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import ObserverSelectionPage from './pages/ObserverSelectionPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SignUpsPage from './pages/SignUpsPage'
import TrackingPage from './pages/TrackingPage'
import TemplatePage from './pages/TemplatePage'

// pages anyone can open without being logged in
const loggedOutPaths = ['/login', '/forgot-password', '/reset-password']
const acPaths = [
  '/dashboard',
  '/template',
  '/cycle-setup',
  '/sign-ups',
  '/observer-selection',
  '/tracking',
  '/kpi-reports',
]
const facultyPaths = [
  '/faculty/status',
  '/faculty/observe-others',
  '/faculty/schedule',
  '/faculty/observer',
  '/faculty/observation',
  '/faculty/survey',
]

export default function App() {
  const { roles } = useAuth()
  const loggedIn = roles.length > 0
  const isACMember = roles.includes('AC Member')
  const hasFacultyAccess = roles.includes('Faculty') || isACMember
  const { pathname, navigate } = useNavigation()
  const defaultPath = isACMember ? '/dashboard' : '/faculty/status'

  useEffect(() => {
    if (!loggedIn && !loggedOutPaths.includes(pathname)) {
      navigate('/login', { replace: true })
    } else if (loggedIn && (pathname === '/' || pathname === '/login')) {
      navigate(defaultPath, { replace: true })
    } else if (loggedIn && acPaths.includes(pathname) && !isACMember) {
      navigate('/faculty/status', { replace: true })
    } else if (
      loggedIn &&
      facultyPaths.includes(pathname) &&
      !hasFacultyAccess
    ) {
      navigate('/dashboard', { replace: true })
    } else if (
      loggedIn &&
      ![...acPaths, ...facultyPaths, ...loggedOutPaths].includes(pathname)
    ) {
      navigate(defaultPath, { replace: true })
    }
  }, [defaultPath, hasFacultyAccess, isACMember, loggedIn, navigate, pathname])

  if (pathname === '/reset-password') {
    return <ResetPasswordPage />
  }

  if (!loggedIn) {
    if (pathname === '/login') return <LoginPage />
    if (pathname === '/forgot-password') return <ForgotPasswordPage />
    return null
  }

  if (
    (acPaths.includes(pathname) && !isACMember) ||
    (facultyPaths.includes(pathname) && !hasFacultyAccess)
  ) {
    return null
  }

  if (pathname === '/login') {
    return <LoginPage />
  }

  let page = <DashboardPage />
  switch (pathname) {
    case '/template':
      page = <TemplatePage />
      break
    case '/cycle-setup':
      page = <CycleSetupPage />
      break
    case '/sign-ups':
      page = <SignUpsPage />
      break
    case '/observer-selection':
      page = <ObserverSelectionPage />
      break
    case '/tracking':
      page = <TrackingPage />
      break
    case '/kpi-reports':
      page = <PlaceholderPage title="KPI Reports" />
      break
    case '/faculty/status':
      page = <PlaceholderPage title="My Status" />
      break
    case '/faculty/observe-others':
      page = <PlaceholderPage title="Observe Others" />
      break
    case '/faculty/schedule':
      page = <PlaceholderPage title="My Schedule" />
      break
    case '/faculty/observer':
      page = <PlaceholderPage title="My Observer" />
      break
    case '/faculty/observation':
      page = <PlaceholderPage title="My Observation" />
      break
    case '/faculty/survey':
      page = <PlaceholderPage title="Survey" />
      break
  }

  return <AppLayout>{page}</AppLayout>
}
