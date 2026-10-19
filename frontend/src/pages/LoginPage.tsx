import { useState, type FormEvent } from 'react'
import { useAuth, type Role } from '../context/AuthContext'
import { useNavigation } from '../context/NavigationContext'

const demoRoles: Role[] = ['AC Member', 'Observee', 'Observer']

export default function LoginPage() {
  const { login } = useAuth()
  const { navigate } = useNavigation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  )

  function enterWorkspace(role: Role) {
    login(role)
    navigate('/dashboard', { replace: true })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: typeof errors = {}

    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.'
    }
    if (!password) {
      nextErrors.password = 'Enter your password.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      enterWorkspace('AC Member')
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

            <button className="button button--primary login-form__submit" type="submit">
              Log in
            </button>
          </form>

          <div aria-hidden="true" className="login-divider">
            <span />
          </div>

          <div aria-label="Demo quick logins" className="demo-logins">
            {demoRoles.map((role) => (
              <button
                className="button button--pill"
                key={role}
                onClick={() => enterWorkspace(role)}
                type="button"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
