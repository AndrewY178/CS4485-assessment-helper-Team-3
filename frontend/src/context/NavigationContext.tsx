import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'

interface NavigationContextValue {
  pathname: string
  navigate: (path: string, options?: { replace?: boolean }) => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(
  undefined,
)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    function handlePopState() {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (options?.replace) {
        window.history.replaceState(null, '', path)
      } else {
        window.history.pushState(null, '', path)
      }
      setPathname(window.location.pathname)
    },
    [],
  )

  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate])

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}

interface AppLinkProps {
  to: string
  className?: string
  activeClassName?: string
  children: ReactNode
}

export function AppLink({
  to,
  className = '',
  activeClassName = '',
  children,
}: AppLinkProps) {
  const { pathname, navigate } = useNavigation()
  const isActive = pathname === to

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(to)
  }

  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={`${className}${isActive && activeClassName ? ` ${activeClassName}` : ''}`}
      href={to}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
