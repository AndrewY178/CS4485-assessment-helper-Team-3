import { get } from './client'
import type { DashboardResponse } from '../types/api'

export function getDashboard(token: string, signal?: AbortSignal) {
  return get<DashboardResponse>('/api/dashboard', { token, signal })
}
