import { useState, type FormEvent } from 'react'
import { ApiError, resetPasswordRequest } from '../api/auth'
import AuthLayout from '../components/AuthLayout'
import { AppLink } from '../context/NavigationContext'

const MIN_PASSWORD_LENGTH = 8

// opened from the emailed link: /reset-password?token=...
// used both for a new account's first password and for "forgot password"
export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await resetPasswordRequest({ token, newPassword: password })
      setDone(true)
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

  if (!token) {
    return (
      <AuthLayout
        subtitle="This page needs the link from your email."
        title="Set your password"
      >
        <div className="login-form">
          <div className="form-banner form-banner--error" role="alert">
            This link is missing its token. Open the link from your email, or
            request a new one.
          </div>
          <AppLink className="auth-link" to="/forgot-password">
            Request a new link
          </AppLink>
        </div>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout
        subtitle="You can now log in with your new password."
        title="Password saved"
      >
        <div className="login-form">
          <div className="form-banner form-banner--success" role="status">
            Your password has been set.
          </div>
          <AppLink className="button button--primary login-form__submit" to="/login">
            Go to log in
          </AppLink>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      subtitle={`Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`}
      title="Set your password"
    >
      <form className="login-form" noValidate onSubmit={handleSubmit}>
        {error && (
          <div className="form-banner form-banner--error" role="alert">
            {error}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="new-password">New password</label>
          <input
            autoComplete="new-password"
            id="new-password"
            name="new-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <span className="form-hint">
            At least {MIN_PASSWORD_LENGTH} characters.
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="confirm-password">Confirm password</label>
          <input
            autoComplete="new-password"
            id="confirm-password"
            name="confirm-password"
            onChange={(event) => setConfirm(event.target.value)}
            type="password"
            value={confirm}
          />
        </div>

        <button
          className="button button--primary login-form__submit"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </AuthLayout>
  )
}
