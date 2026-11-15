import { get } from './client'
import type { PastObservationsResponse } from '../types/api'

export function getPastObservations(token: string, signal?: AbortSignal) {
  return get<PastObservationsResponse>('/api/my-observations', { token, signal })
}
