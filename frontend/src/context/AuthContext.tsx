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

export type Role = 'AC Member' | 'Observee' | 'Observer'

// a person can hold several roles at once so we keep the full list and check it with roles.includes(...).
// ignoring single role functionality set in the draft API contract
interface Session {
  token: string
  roles: Role[]
  userId: string
}

interface AuthContextValue {
  roles: Role[]
  userId: string | null
  // rejects with an ApiError (its message is safe to show to the user)
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
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

  const value = useMemo<AuthContextValue>(
    () => ({
      roles: session?.roles ?? [],
      userId: session?.userId ?? null,
      login,
      logout,
    }),
    [session, login, logout],
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
