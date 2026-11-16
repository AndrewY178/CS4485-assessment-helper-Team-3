import { get } from './client'
import type { UserResponse } from '../types/api'

export function getUsers(signal?: AbortSignal) {
  return get<UserResponse[]>('/api/users', { signal })
}
