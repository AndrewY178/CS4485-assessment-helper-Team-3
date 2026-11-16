import type {
  EvaluationCycleResponse,
  SaveEvaluationCycleRequest,
} from '../types/api'
import { get, put } from './client'

export interface CurrentSemesterResponse {
  semester: string
  nextSemester: string
}

export function getCurrentSemester(token: string, signal?: AbortSignal) {
  return get<CurrentSemesterResponse>('/api/current-semester', { token, signal })
}

export function getEvaluationCycles(token: string, signal?: AbortSignal) {
  return get<EvaluationCycleResponse[]>('/api/schedule', { token, signal })
}

export function saveEvaluationCycle(
  semester: string,
  body: SaveEvaluationCycleRequest,
  token: string,
) {
  return put<EvaluationCycleResponse>(
    `/api/schedule/${encodeURIComponent(semester)}`,
    { body, token },
  )
}
