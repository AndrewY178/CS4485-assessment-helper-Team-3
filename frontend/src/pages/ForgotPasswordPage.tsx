import { useState, type FormEvent } from 'react'
import { ApiError, forgotPasswordRequest } from '../api/auth'
import AuthLayout from '../components/AuthLayout'
import { AppLink } from '../context/NavigationContext'

// 60 -> "1 hour", 120 -> "2 hours", 30 -> "30 minutes"
function formatDuration(minutes: number) {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  return minutes % 60 === 0
    ? plural(minutes / 60, 'hour')
    : plural(minutes, 'minute')
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null)
  const sent = expiresInMinutes !== null
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }

    setSubmitting(true)
    try {
      const response = await forgotPasswordRequest({ email: email.trim() })
      setExpiresInMinutes(response.expiresInMinutes)
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      subtitle="Enter your email and we will send you a link to set a new password."
      title="Forgot password"
    >
      {sent ? (
        <div className="login-form">
          <div className="form-banner form-banner--success" role="status">
            If that email has an account, a link has been sent. The link can
            be used once and expires in {formatDuration(expiresInMinutes)}.
          </div>
          {import.meta.env.DEV && (
            <p className="auth-note">
              Development: email sending is not set up yet, so the link is
              printed in the backend terminal.
            </p>
          )}
          <AppLink className="auth-link" to="/login">
            Back to log in
          </AppLink>
        </div>
      ) : (
        <form className="login-form" noValidate onSubmit={handleSubmit}>
          {error && (
            <div className="form-banner form-banner--error" role="alert">
              {error}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@utdallas.edu"
              type="email"
              value={email}
            />
          </div>

          <button
            className="button button--primary login-form__submit"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Sending...' : 'Send link'}
          </button>

          <AppLink className="auth-link" to="/login">
            Back to log in
          </AppLink>
        </form>
      )}
    </AuthLayout>
  )
}
