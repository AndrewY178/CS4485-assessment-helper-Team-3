import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
} from '../types/api'
import { post } from './client'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
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
  return post<{
    message: string
    purpose: 'set_password' | 'reset_password'
  }>('/api/auth/reset-password', { body })
}
