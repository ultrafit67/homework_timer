import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { HomeworkRecord, Grade, getSubjectsForGrade } from '../types'
import { usePomodoro, POMODORO_PRESETS } from '../hooks/usePomodoro'
import { SubjectButton } from './SubjectButton'
import { addRecord } from '../db'
import { loadGrade } from '../utils'

interface PomodoroTimerProps {
  userName: string
  userIndex: number
  onRecordAdded: (record?: HomeworkRecord) => void
}

export function PomodoroTimer({ userName, userIndex, onRecordAdded }: PomodoroTimerProps) {
  const pomodoro = usePomodoro()
  const [selectedPresetLabel, setSelectedPresetLabel] = useState(POMODORO_PRESETS[0].label)

  const grade = useMemo(() => loadGrade(userIndex), [userIndex])
  const subjects = useMemo(() => getSubjectsForGrade(grade as Grade | 0), [grade])

  const isRunning = pomodoro.phase === 'focusing' || pomodoro.phase === 'break'

  // Register focus-complete callback to save record
  useEffect(() => {
    pomodoro.onFocusComplete((record) => {
      const fullRecord = { ...record, user: userName }
      addRecord(fullRecord).then(() => {
        onRecordAdded(fullRecord)
      })
    })
  }, [pomodoro, userName, onRecordAdded])

  // Notification on phase change (focus end or break end)
  const prevPhaseRef = useRef(pomodoro.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = pomodoro.phase

    if (prev === 'focusing' && pomodoro.phase === 'break') {
      notify(`${pomodoro.selectedSubject} 专注${pomodoro.focusMinutes}分钟完成!`)
    } else if (prev === 'break' && pomodoro.phase === 'focusing') {
      notify('休息时间结束，准备下一轮专注！')
    }
  }, [pomodoro.phase, pomodoro.selectedSubject, pomodoro.focusMinutes])

  const notify = useCallback((body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(pomodoro.phase === 'break' ? '专注结束' : '休息结束', { body })
    }
    try {
      navigator.vibrate?.(200)
    } catch { /* vibrate not available */ }
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch { /* audio not available */ }
  }, [pomodoro.phase])

  // Request notification permission on first interaction
  const requestNotify = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handlePresetClick = (preset: typeof POMODORO_PRESETS[number]) => {
    if (isRunning) return
    setSelectedPresetLabel(preset.label)
    pomodoro.setDurations(preset.focus, preset.break)
  }

  return (
    <div className="pomodoro">
      {/* Preset selector */}
      <div className="pomodoro__presets">
        {POMODORO_PRESETS.map(p => (
          <button
            key={p.label}
            className={`pomodoro__preset-btn ${selectedPresetLabel === p.label ? 'pomodoro__preset-btn--active' : ''}`}
            onClick={() => handlePresetClick(p)}
            disabled={isRunning}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Phase indicator + countdown */}
      <div className="pomodoro__display">
        <div className={`pomodoro__phase ${pomodoro.phase === 'focusing' ? 'pomodoro__phase--focus' : ''} ${pomodoro.phase === 'break' ? 'pomodoro__phase--break' : ''}`}>
          {pomodoro.phase === 'idle' && '选择科目开始番茄钟'}
          {pomodoro.phase === 'subjectSelected' && '准备开始'}
          {pomodoro.phase === 'focusing' && '专注中'}
          {pomodoro.phase === 'break' && '休息中'}
        </div>
        <div className="pomodoro__time">{pomodoro.formattedTime}</div>
        {pomodoro.currentCycle > 0 && (
          <div className="pomodoro__cycle">已完成 {pomodoro.currentCycle} 轮专注</div>
        )}
        {/* Progress bar */}
        <div className="pomodoro__progress-bar">
          <div
            className={`pomodoro__progress-fill ${pomodoro.phase === 'focusing' ? 'pomodoro__progress-fill--focus' : ''} ${pomodoro.phase === 'break' ? 'pomodoro__progress-fill--break' : ''}`}
            style={{ width: `${pomodoro.progress * 100}%` }}
          />
        </div>
      </div>

      {/* Subject grid */}
      {pomodoro.phase !== 'focusing' && pomodoro.phase !== 'break' && (
        <div className="subject-grid">
          {subjects.map(s => (
            <SubjectButton
              key={s}
              subject={s}
              selected={pomodoro.selectedSubject === s}
              disabled={isRunning}
              onClick={pomodoro.selectSubject}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="action-buttons">
        {pomodoro.phase === 'idle' && (
          <p className="pomodoro__hint">选择科目后开始专注</p>
        )}
        {pomodoro.phase === 'subjectSelected' && (
          <button
            className="btn btn--primary btn--large"
            onClick={() => { requestNotify(); pomodoro.start() }}
          >
            开始专注
          </button>
        )}
        {pomodoro.phase === 'focusing' && (
          <div className="action-buttons__row">
            {pomodoro.isPaused ? (
              <button className="btn btn--primary btn--large action-buttons__half" onClick={pomodoro.resume}>继续</button>
            ) : (
              <button className="btn btn--secondary btn--large action-buttons__half" onClick={pomodoro.pause}>暂停</button>
            )}
            <button className="btn btn--danger btn--large action-buttons__half" onClick={pomodoro.stop}>结束</button>
          </div>
        )}
        {pomodoro.phase === 'break' && (
          <div className="action-buttons__row">
            {pomodoro.isPaused ? (
              <button className="btn btn--primary btn--large action-buttons__half" onClick={pomodoro.resume}>继续</button>
            ) : (
              <button className="btn btn--secondary btn--large action-buttons__half" onClick={pomodoro.pause}>暂停</button>
            )}
            <button className="btn btn--secondary btn--large action-buttons__half" onClick={pomodoro.skipBreak}>跳过休息</button>
          </div>
        )}
      </div>
    </div>
  )
}
