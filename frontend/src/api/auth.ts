import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
} from '../types/api'

// empty in development (Vite forwards /api to Flask); set VITE_API_URL elsewhere
const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function post<T>(
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'Something went wrong.')
  }
  return data as T
}

export function loginRequest(body: LoginRequest) {
  return post<LoginResponse>('/api/auth/login', { body })
}

export function logoutRequest(token: string) {
  return post<void>('/api/auth/logout', { token })
}

export function forgotPasswordRequest(body: ForgotPasswordRequest) {
  return post<{ message: string; expiresInMinutes: number }>(
    '/api/auth/forgot-password',
    { body },
  )
}

export function resetPasswordRequest(body: ResetPasswordRequest) {
  return post<{ message: string }>('/api/auth/reset-password', { body })
}
