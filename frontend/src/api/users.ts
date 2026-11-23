import { get, post } from './client'
import type { UserResponse } from '../types/api'

// email is only present when the caller is a logged-in AC member (pass token)
export function getUsers(signal?: AbortSignal, token?: string) {
  return get<UserResponse[]>('/api/users', { signal, token })
}

export interface CreateAccountRequest {
  name: string
  email: string
  department?: string
  prof_rank?: string
}

export function createAccount(body: CreateAccountRequest, token: string) {
  return post<{ id: string; email: string; name: string; roles: string[] }>(
    '/api/users',
    { token, body },
  )
}
