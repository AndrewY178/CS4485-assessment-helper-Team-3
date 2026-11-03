import { useEffect } from 'react'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useNavigation } from './context/NavigationContext'
import DashboardPage from './pages/DashboardPage'
import CycleKpiPage from './pages/CycleKpiPage'
import MyObservationPage from './pages/MyObservationPage'
import MyObserversPage from './pages/MyObserversPage'
import ObserveeStatusPage from './pages/ObserveeStatusPage'
import ObserverRequestsPage from './pages/ObserverRequestsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import CycleSetupPage from './pages/CycleSetupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import ObserverSelectionPage from './pages/ObserverSelectionPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SignUpsPage from './pages/SignUpsPage'
import TrackingPage from './pages/TrackingPage'
import TemplatePage from './pages/TemplatePage'

// pages anyone can open without being logged in
const loggedOutPaths = ['/login', '/forgot-password', '/reset-password']

export default function App() {
  const { roles } = useAuth()
  const loggedIn = roles.length > 0
  const { pathname, navigate } = useNavigation()

  useEffect(() => {
    if (!loggedIn && !loggedOutPaths.includes(pathname)) {
      navigate('/login', { replace: true })
    } else if (loggedIn && pathname === '/') {
      navigate('/dashboard', { replace: true })
    } else if (
      loggedIn &&
      ![
        '/dashboard',
        '/template',
        '/cycle-setup',
        '/sign-ups',
        '/observer-selection',
        '/tracking',
        '/cycle-kpi-report',
        '/my-observers',
        '/my-observation',
        '/observe-others',
        '/my-schedule',
        '/survey',
        '/login',
        '/reset-password',
      ].includes(pathname)
    ) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, pathname, loggedIn])

  
  if (pathname === '/reset-password') {
    return <ResetPasswordPage />
  }

  if (!loggedIn) {
    if (pathname === '/login') return <LoginPage />
    if (pathname === '/forgot-password') return <ForgotPasswordPage />
    return null
  }

  if (pathname === '/login') {
    return <LoginPage />
  }

  let page =
    role === 'Observee'
      ? <ObserveeStatusPage />
      : role === 'Observer'
        ? <PlaceholderPage title="My status" />
        : <DashboardPage />
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
    case '/my-observers':
      page = <MyObserversPage />
      break
    case '/my-observation':
      page = <MyObservationPage />
      break
    case '/observe-others':
      page =
        role === 'Observee'
          ? <PlaceholderPage title="Observe others" />
          : <ObserverRequestsPage />
      break
    case '/my-schedule':
      page = <PlaceholderPage title="My schedule" />
      break
    case '/survey':
      page = <PlaceholderPage title="Survey" />
      break
  }

  return <AppLayout>{page}</AppLayout>
}
