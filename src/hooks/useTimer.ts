import { useState, useEffect, useRef, useCallback } from 'react'
import { Subject, HomeworkRecord } from '../types'
import { generateId, getTodayDate } from '../utils'

export type TimerStatus = 'idle' | 'subjectSelected' | 'timing' | 'paused'

interface TimerState {
  status: TimerStatus
  selectedSubject: Subject | null
  startTime: string | null   // ISO string saved in the record
  timingStart: number | null // Date.now() when the current timing segment began
  accruedMs: number          // accumulated ms from completed timing segments
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
  complete: () => Omit<HomeworkRecord, 'user'> & { user: string } | null
  reset: () => void
}

function computeElapsed(state: TimerState): number {
  const now = Date.now()
  const running = state.timingStart ? now - state.timingStart : 0
  return state.accruedMs + running
}

function getSavedState(userName: string): TimerState | null {
  try {
    const raw = sessionStorage.getItem(`timer-state-${userName}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Validate it's a real TimerState
      if (parsed && typeof parsed === 'object' && 'status' in parsed) {
        return parsed
      }
    }
  } catch { /* ignore corrupt data */ }
  return null
}

function saveState(userName: string, state: TimerState): void {
  try {
    sessionStorage.setItem(`timer-state-${userName}`, JSON.stringify(state))
  } catch { /* storage full or unavailable */ }
}

function clearSavedState(userName: string): void {
  try {
    sessionStorage.removeItem(`timer-state-${userName}`)
  } catch { /* ignore */ }
}

const INITIAL_STATE: TimerState = {
  status: 'idle',
  selectedSubject: null,
  startTime: null,
  timingStart: null,
  accruedMs: 0
}

export function useTimer(userName: string): UseTimerReturn {
  const [state, setState] = useState<TimerState>(() => {
    return getSavedState(userName) || INITIAL_STATE
  })
  // Tick counter — only purpose is to trigger re-renders so elapsed time refreshes
  const [, setTick] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (state.status === 'timing') {
      const id = window.setInterval(() => {
        setTick(t => t + 1)
      }, 1000)
      return () => clearInterval(id)
    }
  }, [state.status])

  // Persist timer state to sessionStorage — survives page refresh/reload
  useEffect(() => {
    saveState(userName, state)
  }, [state, userName])

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
        return {
          ...prev,
          status: 'timing',
          timingStart: Date.now(),
          startTime: new Date().toISOString(),
          accruedMs: 0
        }
      }
      return prev
    })
  }, [])

  const pause = useCallback(() => {
    setState(prev => {
      if (prev.status === 'timing' && prev.timingStart !== null) {
        return {
          ...prev,
          status: 'paused',
          accruedMs: prev.accruedMs + (Date.now() - prev.timingStart),
          timingStart: null
        }
      }
      return prev
    })
  }, [])

  const resume = useCallback(() => {
    setState(prev => {
      if (prev.status === 'paused') {
        return { ...prev, status: 'timing', timingStart: Date.now() }
      }
      return prev
    })
  }, [])

  const complete = useCallback(() => {
    const s = stateRef.current
    if (s.selectedSubject && s.startTime) {
      const elapsedMs = computeElapsed(s)
      const now = new Date().toISOString()
      const record = {
        id: generateId(),
        subject: s.selectedSubject,
        startTime: s.startTime,
        endTime: now,
        durationSeconds: Math.round(elapsedMs / 1000),
        date: getTodayDate(),
        user: userName
      }
      setState(INITIAL_STATE)
      clearSavedState(userName)
      return record
    }
    return null
  }, [userName])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    clearSavedState(userName)
  }, [userName])

  const elapsedMs = computeElapsed(state)
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return {
    status: state.status,
    selectedSubject: state.selectedSubject,
    elapsedSeconds: totalSeconds,
    formattedTime,
    selectSubject,
    start,
    pause,
    resume,
    complete,
    reset
  }
}
