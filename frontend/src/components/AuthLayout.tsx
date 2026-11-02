import type { ReactNode } from 'react'
import '../styles/auth.css'

// for the forgot-password and set-password pages
export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="login-page">
      <section aria-label="About Assessment Helper" className="login-brand">
        <div className="login-brand__intro">
          <h1>Assessment Helper</h1>
          <p>
            Track who is due, match observers, and complete observations
            without spreadsheets or email chains.
          </p>
        </div>
        <p className="login-brand__footer">
          Supporting better teaching, together.
        </p>
      </section>

      <section aria-label={title} className="login-area">
        <div className="login-card">
          <h2>{title}</h2>
          <p className="login-card__subtitle">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  )
}
