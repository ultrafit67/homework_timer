import { useState, useEffect, useRef, useCallback } from 'react'
import { Subject, HomeworkRecord } from '../types'
import { generateId, formatDate } from '../utils'

export type PomodoroPhase = 'idle' | 'subjectSelected' | 'focusing' | 'break'

export const POMODORO_PRESETS = [
  { label: '25+5', focus: 25, break: 5 },
  { label: '45+10', focus: 45, break: 10 },
  { label: '50+10', focus: 50, break: 10 },
]

interface UsePomodoroOptions {
  focusMinutes?: number
  breakMinutes?: number
}

export interface UsePomodoroReturn {
  phase: PomodoroPhase
  isPaused: boolean
  remainingSeconds: number
  formattedTime: string
  progress: number
  focusMinutes: number
  breakMinutes: number
  currentCycle: number
  selectedSubject: Subject | null
  selectSubject: (subject: Subject) => void
  start: () => void
  pause: () => void
  resume: () => void
  skipBreak: () => void
  stop: () => void
  setDurations: (focus: number, break_: number) => void
  onFocusComplete: (cb: (record: Omit<HomeworkRecord, 'user'>) => void) => void
}

interface SavedState {
  phase: PomodoroPhase
  selectedSubject: Subject | null
  focusMinutes: number
  breakMinutes: number
  currentCycle: number
  deadline: number | null
  savedRemaining: number
  isPaused: boolean
  focusStartSubject: Subject | null
  focusStartTime: string | null
}

function savePomodoroState(key: string, state: SavedState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch { /**/ }
}

function loadPomodoroState(key: string): { state: SavedState | null; remainingSeconds: number } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { state: null, remainingSeconds: 0 }
    const state: SavedState = JSON.parse(raw)
    let remainingSeconds = 0
    if (state.deadline !== null && !state.isPaused) {
      remainingSeconds = Math.max(0, Math.round((state.deadline - Date.now()) / 1000))
    } else {
      remainingSeconds = state.savedRemaining ?? 0
    }
    return { state, remainingSeconds }
  } catch {
    return { state: null, remainingSeconds: 0 }
  }
}

export function usePomodoro(storageKey?: string, options: UsePomodoroOptions = {}): UsePomodoroReturn {
  const [phase, setPhase] = useState<PomodoroPhase>(() => {
    if (!storageKey) return 'idle'
    const { state } = loadPomodoroState(storageKey)
    return state?.phase ?? 'idle'
  })
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(() => {
    if (!storageKey) return null
    const { state } = loadPomodoroState(storageKey)
    return state?.selectedSubject ?? null
  })
  const [focusMinutes, setFocusMinutes] = useState(() => {
    if (!storageKey) return options.focusMinutes || 25
    const { state } = loadPomodoroState(storageKey)
    return state?.focusMinutes ?? (options.focusMinutes || 25)
  })
  const [breakMinutes, setBreakMinutes] = useState(() => {
    if (!storageKey) return options.breakMinutes || 5
    const { state } = loadPomodoroState(storageKey)
    return state?.breakMinutes ?? (options.breakMinutes || 5)
  })
  const [currentCycle, setCurrentCycle] = useState(() => {
    if (!storageKey) return 0
    const { state } = loadPomodoroState(storageKey)
    return state?.currentCycle ?? 0
  })
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!storageKey) return 0
    const { remainingSeconds } = loadPomodoroState(storageKey)
    return remainingSeconds
  })
  const [isPaused, setIsPaused] = useState(() => {
    if (!storageKey) return false
    const { state } = loadPomodoroState(storageKey)
    return state?.isPaused ?? false
  })

  const intervalRef = useRef<number | null>(null)
  const totalSecondsRef = useRef(0)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const focusMinutesRef = useRef(focusMinutes)
  focusMinutesRef.current = focusMinutes
  const breakMinutesRef = useRef(breakMinutes)
  breakMinutesRef.current = breakMinutes
  const selectedSubjectRef = useRef(selectedSubject)
  selectedSubjectRef.current = selectedSubject
  const remainingRef = useRef(remainingSeconds)
  remainingRef.current = remainingSeconds

  const focusStartRef = useRef<{ subject: Subject; startTime: string } | null>(null)
  const onFocusCompleteRef = useRef<((record: Omit<HomeworkRecord, 'user'>) => void) | null>(null)
  // Guard against React 19 StrictMode double-invoking state updater functions
  // in startTimer's setRemainingSeconds callback
  const focusFiredRef = useRef(false)

  // Mount-restore: auto-start running timer, handle expired timer during refresh
  // Must NOT use a one-shot guard — React 19 StrictMode double-invokes effects
  // and the cleanup effect clears the interval between invocations.
  useEffect(() => {
    if (!storageKey) return

    const { state } = loadPomodoroState(storageKey)
    if (state?.focusStartSubject && state?.focusStartTime) {
      focusStartRef.current = { subject: state.focusStartSubject, startTime: state.focusStartTime }
    }

    const isRunning = phase === 'focusing' || phase === 'break'
    if (!isRunning) return

    if (remainingSeconds === 0) {
      if (phase === 'focusing') {
        setPhase('break')
        totalSecondsRef.current = breakMinutes * 60
        setRemainingSeconds(breakMinutes * 60)
        setCurrentCycle(c => c + 1)
      } else {
        setPhase('focusing')
        focusFiredRef.current = false
        totalSecondsRef.current = focusMinutes * 60
        setRemainingSeconds(focusMinutes * 60)
        if (selectedSubject) focusStartRef.current = { subject: selectedSubject, startTime: new Date().toISOString() }
      }
    } else if (!isPaused && remainingSeconds > 0) {
      startTimer()
    }
  }, [storageKey])

  const [initDone, setInitDone] = useState(false)
  useEffect(() => {
    if (!storageKey) return
    if (!initDone) {
      setInitDone(true)
      return
    }
    const isRunning = phase === 'focusing' || phase === 'break'
    savePomodoroState(storageKey, {
      phase,
      selectedSubject,
      focusMinutes,
      breakMinutes,
      currentCycle,
      isPaused,
      deadline: isRunning && !isPaused ? Date.now() + remainingRef.current * 1000 : null,
      savedRemaining: (isRunning && isPaused) || (!isRunning) ? remainingRef.current : 0,
      focusStartSubject: focusStartRef.current?.subject ?? null,
      focusStartTime: focusStartRef.current?.startTime ?? null,
    })
  }, [storageKey, initDone, phase, selectedSubject, focusMinutes, breakMinutes, currentCycle, isPaused])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const onFocusComplete = useCallback((cb: (record: Omit<HomeworkRecord, 'user'>) => void) => {
    onFocusCompleteRef.current = cb
  }, [])

  const fireFocusComplete = useCallback(() => {
    if (focusFiredRef.current) return
    focusFiredRef.current = true
    const f = focusStartRef.current
    if (f && onFocusCompleteRef.current) {
      const endTime = new Date().toISOString()
      const durationSeconds = Math.round((new Date(endTime).getTime() - new Date(f.startTime).getTime()) / 1000)
      onFocusCompleteRef.current({
        id: generateId(),
        subject: f.subject,
        startTime: f.startTime,
        endTime,
        durationSeconds,
        date: formatDate(new Date(f.startTime)),
      })
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    setIsPaused(false)
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearTimer()
          const currentPhase = phaseRef.current
          if (currentPhase === 'focusing') {
            // Guard entire block against StrictMode double-invoke of updater
            if (!focusFiredRef.current) {
              fireFocusComplete()
              const bm = breakMinutesRef.current
              setPhase('break')
              totalSecondsRef.current = bm * 60
              setCurrentCycle(c => c + 1)
            }
            return breakMinutesRef.current * 60
          } else if (currentPhase === 'break') {
            // Idempotent — safe under StrictMode double-invoke
            const fm = focusMinutesRef.current
            setPhase('focusing')
            focusFiredRef.current = false
            totalSecondsRef.current = fm * 60
            const subj = selectedSubjectRef.current
            if (subj) {
              focusStartRef.current = { subject: subj, startTime: new Date().toISOString() }
            }
            return fm * 60
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimer, fireFocusComplete])

  const selectSubject = useCallback((subject: Subject) => {
    if (phase === 'idle') {
      setSelectedSubject(subject)
      setPhase('subjectSelected')
    } else if (phase === 'subjectSelected') {
      setSelectedSubject(subject)
    }
  }, [phase])

  const start = useCallback(() => {
    if (phase === 'subjectSelected' && selectedSubjectRef.current) {
      setPhase('focusing')
      focusFiredRef.current = false
      const fm = focusMinutesRef.current
      setRemainingSeconds(fm * 60)
      totalSecondsRef.current = fm * 60
      focusStartRef.current = { subject: selectedSubjectRef.current, startTime: new Date().toISOString() }
      startTimer()
    }
  }, [phase, startTimer])

  const pause = useCallback(() => {
    clearTimer()
    setIsPaused(true)
  }, [clearTimer])

  const resume = useCallback(() => {
    if (phase === 'focusing' || phase === 'break') {
      startTimer()
    }
  }, [phase, startTimer])

  const skipBreak = useCallback(() => {
    if (phase === 'break') {
      clearTimer()
      setPhase('focusing')
      focusFiredRef.current = false
      const fm = focusMinutesRef.current
      setRemainingSeconds(fm * 60)
      totalSecondsRef.current = fm * 60
      const subj = selectedSubjectRef.current
      if (subj) {
        focusStartRef.current = { subject: subj, startTime: new Date().toISOString() }
      }
      startTimer()
    }
  }, [phase, startTimer, clearTimer])

  const stop = useCallback(() => {
    clearTimer()
    if (phaseRef.current === 'focusing' && focusStartRef.current) {
      fireFocusComplete()
    }
    setIsPaused(false)
    setPhase('idle')
    setSelectedSubject(null)
    setRemainingSeconds(0)
    totalSecondsRef.current = 0
    setCurrentCycle(0)
    focusStartRef.current = null
  }, [clearTimer, fireFocusComplete])

  const setDurations = useCallback((focus: number, break_: number) => {
    setFocusMinutes(focus)
    setBreakMinutes(break_)
    if (phase === 'idle' || phase === 'subjectSelected') {
      setRemainingSeconds(0)
      totalSecondsRef.current = 0
    }
  }, [phase])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const progress = totalSecondsRef.current > 0
    ? Math.min(1, 1 - remainingSeconds / totalSecondsRef.current)
    : 0

  const m = Math.floor(remainingSeconds / 60)
  const s = remainingSeconds % 60
  const formattedTime = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  return {
    phase,
    isPaused,
    remainingSeconds,
    formattedTime,
    progress,
    focusMinutes,
    breakMinutes,
    currentCycle,
    selectedSubject,
    selectSubject,
    start,
    pause,
    resume,
    skipBreak,
    stop,
    setDurations,
    onFocusComplete,
  }
}
