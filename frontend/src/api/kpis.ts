import { get } from './client'
import type { KpisResponse } from '../types/api'

export function getKpis(token: string, signal?: AbortSignal) {
  return get<KpisResponse>('/api/kpis', { token, signal })
}
