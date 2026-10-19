import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { NavigationProvider } from './context/NavigationContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NavigationProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </NavigationProvider>
  </StrictMode>,
)