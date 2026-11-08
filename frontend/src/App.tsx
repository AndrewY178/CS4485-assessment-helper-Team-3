import { useEffect } from 'react'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useNavigation } from './context/NavigationContext'
import CycleKpiPage from './pages/ac/CycleKpiPage'
import CycleSetupPage from './pages/ac/CycleSetupPage'
import DashboardPage from './pages/ac/DashboardPage'
import ObserverSelectionPage from './pages/ac/ObserverSelectionPage'
import SignUpsPage from './pages/ac/SignUpsPage'
import TemplatePage from './pages/ac/TemplatePage'
import TrackingPage from './pages/ac/TrackingPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import FacultyStatusPage from './pages/faculty/FacultyStatusPage'
import MySchedulePage from './pages/faculty/MySchedulePage'
import MyObservationPage from './pages/faculty/observee/MyObservationPage'
import MyObserversPage from './pages/faculty/observee/MyObserversPage'
import ObservationFormsPage from './pages/faculty/observer/ObservationFormsPage'
import ObserverRequestsPage from './pages/faculty/observer/ObserverRequestsPage'
import PlaceholderPage from './pages/shared/PlaceholderPage'

const loggedOutPaths = ['/login', '/forgot-password', '/reset-password']

const acPaths = [
  '/dashboard',
  '/template',
  '/cycle-setup',
  '/sign-ups',
  '/observer-selection',
  '/tracking',
  '/cycle-kpi-report',
]

const facultyPaths = [
  '/faculty/status',
  '/my-observers',
  '/my-observation',
  '/observe-others',
  '/observation-forms',
  '/my-schedule',
  '/survey',
]

export default function App() {
  const { roles } = useAuth()
  const loggedIn = roles.length > 0
  const isACMember = roles.includes('AC Member')
  // AC membership takes precedence for legacy accounts that currently return
  // both strings. AC Members and Faculty use separate workspaces.
  const isFaculty = roles.includes('Faculty') && !isACMember
  const { pathname, navigate } = useNavigation()
  const defaultPath = isACMember ? '/dashboard' : '/faculty/status'

  useEffect(() => {
    if (!loggedIn && !loggedOutPaths.includes(pathname)) {
      navigate('/login', { replace: true })
    } else if (loggedIn && (pathname === '/' || pathname === '/login')) {
      navigate(defaultPath, { replace: true })
    } else if (loggedIn && acPaths.includes(pathname) && !isACMember) {
      navigate('/faculty/status', { replace: true })
    } else if (loggedIn && facultyPaths.includes(pathname) && !isFaculty) {
      navigate('/dashboard', { replace: true })
    } else if (
      loggedIn &&
      ![...acPaths, ...facultyPaths, ...loggedOutPaths].includes(pathname)
    ) {
      navigate(defaultPath, { replace: true })
    }
  }, [defaultPath, isACMember, isFaculty, loggedIn, navigate, pathname])

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
    (facultyPaths.includes(pathname) && !isFaculty)
  ) {
    return null
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
    case '/cycle-kpi-report':
      page = <CycleKpiPage />
      break
    case '/faculty/status':
      page = <FacultyStatusPage />
      break
    case '/my-observers':
      page = <MyObserversPage />
      break
    case '/my-observation':
      page = <MyObservationPage />
      break
    case '/observe-others':
      page = <ObserverRequestsPage />
      break
    case '/observation-forms':
      page = <ObservationFormsPage />
      break
    case '/my-schedule':
      page = <MySchedulePage />
      break
    case '/survey':
      page = <PlaceholderPage title="Survey" />
      break
  }

  return <AppLayout>{page}</AppLayout>
}
