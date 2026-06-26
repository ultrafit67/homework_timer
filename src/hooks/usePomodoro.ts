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

export function usePomodoro(options: UsePomodoroOptions = {}): UsePomodoroReturn {
  const [phase, setPhase] = useState<PomodoroPhase>('idle')
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [focusMinutes, setFocusMinutes] = useState(options.focusMinutes || 25)
  const [breakMinutes, setBreakMinutes] = useState(options.breakMinutes || 5)
  const [currentCycle, setCurrentCycle] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const intervalRef = useRef<number | null>(null)
  const totalSecondsRef = useRef(0)

  // Refs to avoid stale closures in setInterval callback
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const focusMinutesRef = useRef(focusMinutes)
  focusMinutesRef.current = focusMinutes
  const breakMinutesRef = useRef(breakMinutes)
  breakMinutesRef.current = breakMinutes
  const selectedSubjectRef = useRef(selectedSubject)
  selectedSubjectRef.current = selectedSubject

  // Track current focus for record creation
  const focusStartRef = useRef<{ subject: Subject; startTime: string } | null>(null)
  const onFocusCompleteRef = useRef<((record: Omit<HomeworkRecord, 'user'>) => void) | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Expose setter for parent to register focus-complete callback
  const onFocusComplete = useCallback((cb: (record: Omit<HomeworkRecord, 'user'>) => void) => {
    onFocusCompleteRef.current = cb
  }, [])

  const fireFocusComplete = useCallback(() => {
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
            fireFocusComplete()
            const bm = breakMinutesRef.current
            setPhase('break')
            totalSecondsRef.current = bm * 60
            setCurrentCycle(c => c + 1)
            return bm * 60
          } else if (currentPhase === 'break') {
            const fm = focusMinutesRef.current
            setPhase('focusing')
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
      const fm = focusMinutesRef.current
      setPhase('focusing')
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
      const fm = focusMinutesRef.current
      setPhase('focusing')
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
    setIsPaused(false)
    setPhase('idle')
    setSelectedSubject(null)
    setRemainingSeconds(0)
    totalSecondsRef.current = 0
    setCurrentCycle(0)
    focusStartRef.current = null
  }, [clearTimer])

  const setDurations = useCallback((focus: number, break_: number) => {
    setFocusMinutes(focus)
    setBreakMinutes(break_)
    if (phase === 'idle' || phase === 'subjectSelected') {
      setRemainingSeconds(0)
      totalSecondsRef.current = 0
    }
  }, [phase])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  // Compute derived values
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
