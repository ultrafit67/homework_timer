import { useState, useEffect, useRef, useCallback } from 'react'
import { Subject } from '../types'
import { generateId, getTodayDate } from '../utils'

export type TimerStatus = 'idle' | 'subjectSelected' | 'timing' | 'paused'

interface TimerState {
  status: TimerStatus
  selectedSubject: Subject | null
  elapsedSeconds: number
  startTime: string | null
}

interface UseTimerReturn {
  status: TimerStatus
  selectedSubject: Subject | null
  elapsedSeconds: number
  formattedTime: string
  selectSubject: (subject: Subject) => void
  start: () => void
  pause: () => void
  resume: () => void
  complete: () => { id: string; subject: Subject; startTime: string; endTime: string; durationSeconds: number; date: string } | null
  reset: () => void
}

export function useTimer(): UseTimerReturn {
  const [state, setState] = useState<TimerState>({
    status: 'idle',
    selectedSubject: null,
    elapsedSeconds: 0,
    startTime: null
  })
  const intervalRef = useRef<number | null>(null)
  // Keep a ref to the latest state so callbacks can read it without stale closures
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (state.status === 'timing') {
      intervalRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }))
      }, 1000)
    }
    if (state.status === 'paused') {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.status])

  const selectSubject = useCallback((subject: Subject) => {
    setState(prev => {
      if (prev.status === 'idle') {
        return { ...prev, status: 'subjectSelected', selectedSubject: subject }
      }
      if (prev.status === 'subjectSelected') {
        return { ...prev, selectedSubject: subject }
      }
      return prev
    })
  }, [])

  const start = useCallback(() => {
    setState(prev => {
      if (prev.status === 'subjectSelected' && prev.selectedSubject) {
        const now = new Date().toISOString()
        return { ...prev, status: 'timing', elapsedSeconds: 0, startTime: now }
      }
      return prev
    })
  }, [])

  const pause = useCallback(() => {
    setState(prev => {
      if (prev.status === 'timing') {
        return { ...prev, status: 'paused' }
      }
      return prev
    })
  }, [])

  const resume = useCallback(() => {
    setState(prev => {
      if (prev.status === 'paused') {
        return { ...prev, status: 'timing' }
      }
      return prev
    })
  }, [])

  const complete = useCallback(() => {
    const s = stateRef.current
    if (s.status === 'timing' && s.selectedSubject && s.startTime) {
      const now = new Date().toISOString()
      const record = {
        id: generateId(),
        subject: s.selectedSubject,
        startTime: s.startTime,
        endTime: now,
        durationSeconds: s.elapsedSeconds,
        date: getTodayDate()
      }
      setState({ status: 'idle', selectedSubject: null, elapsedSeconds: 0, startTime: null })
      return record
    }
    return null
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', selectedSubject: null, elapsedSeconds: 0, startTime: null })
  }, [])

  const hours = Math.floor(state.elapsedSeconds / 3600)
  const minutes = Math.floor((state.elapsedSeconds % 3600) / 60)
  const seconds = state.elapsedSeconds % 60
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return {
    status: state.status,
    selectedSubject: state.selectedSubject,
    elapsedSeconds: state.elapsedSeconds,
    formattedTime,
    selectSubject,
    start,
    pause,
    resume,
    complete,
    reset
  }
}
