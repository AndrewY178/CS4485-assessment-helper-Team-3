import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, loginRequest, logoutRequest } from '../api/auth'
import { useNavigation } from './NavigationContext'

// This context intentionally exports its provider and related hooks together.
/* eslint-disable react-refresh/only-export-components */

export type Role = 'AC Member' | 'Faculty'

// The API transports permissions as an array, so callers use roles.includes(...)
// instead of relying on the removed singular `role` variable.
interface Session {
  token: string
  roles: Role[]
  userId: string
}

interface AuthContextValue {
  roles: Role[]
  userId: string | null
  token: string | null
  // rejects with an ApiError (its message is safe to show to the user)
  login: (email: string, password: string) => Promise<Role[]>
  logout: () => Promise<void>
  switchRoleForTesting: (role: Role) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// The login is saved in this browser tab's sessionStorage: refreshing the page keeps you
// logged in, and closing the tab logs you out. If the browser blocks storage, saving fails
// quietly and the login lasts only until a refresh.
const STORAGE_KEY = 'assessment-helper-session'

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // storage unavailable
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest({ email, password })

    if (response.roles.length === 0) {
      // the account exists but has no role yet; do not keep the session open
      await logoutRequest(response.token).catch(() => undefined)
      throw new ApiError(
        403,
        'Your account has no role yet. Contact the assessment committee.',
      )
    }

    const next: Session = {
      token: response.token,
      roles: response.roles,
      userId: response.userId,
    }
    saveSession(next)
    setSession(next)
    return response.roles
  }, [])

  const logout = useCallback(async () => {
    const token = session?.token
    // clear locally first so the screen responds immediately
    saveSession(null)
    setSession(null)
    if (token) {
      await logoutRequest(token).catch(() => undefined)
    }
  }, [session])

  const switchRoleForTesting = useCallback((role: Role) => {
    if (!import.meta.env.DEV) return

    setSession((current) => {
      if (!current) return current

      const next: Session = { ...current, roles: [role] }
      saveSession(next)
      return next
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      roles: session?.roles ?? [],
      userId: session?.userId ?? null,
      token: session?.token ?? null,
      login,
      logout,
      switchRoleForTesting,
    }),
    [session, login, logout, switchRoleForTesting],
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
    void logout()
    navigate('/login', { replace: true })
  }
}
