import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { AppLink, useNavigation } from '../context/NavigationContext'
import '../styles/auth.css'

export default function LoginPage() {
  const { login } = useAuth()
  const { navigate } = useNavigation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  )
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: typeof errors = {}

    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.'
    }
    if (!password) {
      nextErrors.password = 'Enter your password.'
    }

    setErrors(nextErrors)
    setServerError('')
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

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

      <section aria-label="Log in" className="login-area">
        <div className="login-card">
          <h2>Log in</h2>
          <p className="login-card__subtitle">
            Access your teaching observation workspace.
          </p>

          <form className="login-form" noValidate onSubmit={handleSubmit}>
            {serverError && (
              <div className="form-banner form-banner--error" role="alert">
                {serverError}
              </div>
            )}

            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                autoComplete="email"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={Boolean(errors.email)}
                id="email"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (errors.email) {
                    setErrors((current) => ({ ...current, email: undefined }))
                  }
                }}
                placeholder="you@utdallas.edu"
                type="email"
                value={email}
              />
              {errors.email && (
                <span className="form-error" id="email-error" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                autoComplete="current-password"
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
                aria-invalid={Boolean(errors.password)}
                id="password"
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (errors.password) {
                    setErrors((current) => ({
                      ...current,
                      password: undefined,
                    }))
                  }
                }}
                placeholder="Enter your password"
                type="password"
                value={password}
              />
              {errors.password && (
                <span
                  className="form-error"
                  id="password-error"
                  role="alert"
                >
                  {errors.password}
                </span>
              )}
            </div>

            <button
              className="button button--primary login-form__submit"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Logging in...' : 'Log in'}
            </button>

            <AppLink className="auth-link" to="/forgot-password">
              Forgot password?
            </AppLink>
          </form>
        </div>
      </section>
    </main>
  )
}
