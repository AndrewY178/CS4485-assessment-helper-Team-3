import { put } from './client'
import type { UpdateProfessorRankResponse } from '../types/api'

export function updateProfessorRank(
  professorId: string,
  profRank: string,
  token: string,
) {
  return put<UpdateProfessorRankResponse>(`/api/users/${professorId}/rank`, {
    token,
    body: { prof_rank: profRank },
  })
}
