import { ApiError } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export async function get<T>(path: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`)
  } catch {
    throw new ApiError(0, 'Cannot reach the server.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'Something went wrong.')
  }

  return data as T
}

export async function post<T>(path: string, token: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'Something went wrong.')
  }

  return data as T
}