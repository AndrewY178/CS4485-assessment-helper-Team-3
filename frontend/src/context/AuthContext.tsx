import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigation } from './NavigationContext'

export type Role = 'AC Member' | 'Observee' | 'Observer'

interface AuthContextValue {
  role: Role | null
  login: (role: Role) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      login: setRole,
      logout: () => setRole(null),
    }),
    [role],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

export function useLogout() {
  const { logout } = useAuth()
  const { navigate } = useNavigation()

  return () => {
    logout()
    navigate('/login', { replace: true })
  }
}
