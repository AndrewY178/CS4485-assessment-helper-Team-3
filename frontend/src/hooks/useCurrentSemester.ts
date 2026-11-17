import { useCallback, useEffect, useState } from 'react'
import {
  getCurrentSemester,
  type CurrentSemesterResponse,
} from '../api/cycleSetup'
import { useAuth } from '../context/AuthContext'

interface CurrentSemesterState {
  semester: string | null
  nextSemester: string | null
  isLoading: boolean
  error: string | null
}

let cachedSemester: CurrentSemesterResponse | null = null
let pendingRequest: Promise<CurrentSemesterResponse> | null = null

function requestCurrentSemester(token: string) {
  if (cachedSemester) return Promise.resolve(cachedSemester)

  if (!pendingRequest) {
    pendingRequest = getCurrentSemester(token)
      .then((response) => {
        cachedSemester = response
        return response
      })
      .finally(() => {
        pendingRequest = null
      })
  }

  return pendingRequest
}

function initialState(token: string | null): CurrentSemesterState {
  if (!token) {
    return {
      semester: null,
      nextSemester: null,
      isLoading: false,
      error: 'Your session is unavailable. Please sign in again.',
    }
  }

  return {
    semester: cachedSemester?.semester ?? null,
    nextSemester: cachedSemester?.nextSemester ?? null,
    isLoading: !cachedSemester,
    error: null,
  }
}

export function useCurrentSemester() {
  const { token } = useAuth()
  const [state, setState] = useState<CurrentSemesterState>(() => initialState(token))
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    if (!token) return

    let active = true
    void requestCurrentSemester(token)
      .then((response) => {
        if (!active) return
        setState({
          semester: response.semester,
          nextSemester: response.nextSemester,
          isLoading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          semester: null,
          nextSemester: null,
          isLoading: false,
          error: error instanceof Error
            ? error.message
            : 'The current semester could not be loaded.',
        })
      })

    return () => {
      active = false
    }
  }, [requestVersion, token])

  const retry = useCallback(() => {
    cachedSemester = null
    pendingRequest = null
    setState({
      semester: null,
      nextSemester: null,
      isLoading: true,
      error: null,
    })
    setRequestVersion((version) => version + 1)
  }, [])

  return { ...state, retry }
}
