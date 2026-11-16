import { ApiError } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

interface GetOptions {
  signal?: AbortSignal
  token?: string
}

export async function get<T>(
  path: string,
  options: GetOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'Cannot reach the server.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'Something went wrong.')
  }

  return data as T
}

export async function post<T>(
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
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined
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

export async function put<T>(
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
      method: 'PUT',
      headers,
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined
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

async function authenticatedRequest<T>(
  path: string,
  token: string,
  method: 'POST' | 'PATCH',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + token,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

export function postJson<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  return authenticatedRequest(path, token, 'POST', body)
}

export function patch<T>(path: string, token: string): Promise<T> {
  return authenticatedRequest(path, token, 'PATCH')
}

export async function getAuthenticated<T>(
  path: string,
  token: string,
): Promise<T> {
  return get<T>(path, { token })
}
