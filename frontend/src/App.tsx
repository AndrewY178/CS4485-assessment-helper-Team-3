import { useEffect } from 'react'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useNavigation } from './context/NavigationContext'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'
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

  let page = <DashboardPage />
  switch (pathname) {
    case '/template':
      page = <TemplatePage />
      break
    case '/cycle-setup':
      page = <PlaceholderPage title="Cycle setup" />
      break
    case '/sign-ups':
      page = <PlaceholderPage title="Sign-ups" />
      break
    case '/observer-selection':
      page = <PlaceholderPage title="Observer selection" />
      break
    case '/tracking':
      page = <PlaceholderPage title="Tracking" />
      break
  }

  return <AppLayout>{page}</AppLayout>
}
