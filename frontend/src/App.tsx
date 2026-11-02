import { useEffect } from 'react'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useNavigation } from './context/NavigationContext'
import DashboardPage from './pages/DashboardPage'
import CycleKpiPage from './pages/CycleKpiPage'
import LoginPage from './pages/LoginPage'
import MyObservationPage from './pages/MyObservationPage'
import MyObserversPage from './pages/MyObserversPage'
import ObserveeStatusPage from './pages/ObserveeStatusPage'
import ObserverRequestsPage from './pages/ObserverRequestsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SignUpsPage from './pages/SignUpsPage'
import TrackingPage from './pages/TrackingPage'
import TemplatePage from './pages/TemplatePage'

export default function App() {
  const { role } = useAuth()
  const { pathname, navigate } = useNavigation()

  useEffect(() => {
    if (!role && pathname !== '/login') {
      navigate('/login', { replace: true })
    } else if (role && pathname === '/') {
      navigate('/dashboard', { replace: true })
    } else if (
      role &&
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
      ].includes(pathname)
    ) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, pathname, role])

  if (!role) {
    return pathname === '/login' ? <LoginPage /> : null
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
      page = <PlaceholderPage title="Cycle setup" />
      break
    case '/sign-ups':
      page = <SignUpsPage />
      break
    case '/observer-selection':
      page = <PlaceholderPage title="Observer selection" />
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
