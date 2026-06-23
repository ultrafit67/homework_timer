import { useState } from 'react'
import { SUBJECTS, Subject } from '../types'
import { useTimer } from '../hooks/useTimer'
import { SubjectButton } from './SubjectButton'
import { TimerDisplay } from './TimerDisplay'
import { ConfirmDialog } from './ConfirmDialog'
import { addRecord } from '../db'

interface TimerPanelProps {
  userName: string
  onRecordAdded: () => void
}

export function TimerPanel({ userName, onRecordAdded }: TimerPanelProps) {
  const timer = useTimer(userName)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTiming = timer.status === 'timing'
  const isPaused = timer.status === 'paused'
  const isRunning = isTiming || isPaused

  const handleStart = () => {
    timer.start()
  }

  const handleComplete = () => {
    setShowConfirm(true)
  }

  const handleConfirmComplete = async () => {
    setShowConfirm(false)
    try {
      const record = timer.complete()
      if (record) {
        await addRecord(record)
        onRecordAdded()
      }
    } catch (e) {
      console.error('Failed to save record', e)
      setError('保存失败，请重试')
    }
  }

  const handleSubjectClick = (subject: Subject) => {
    timer.selectSubject(subject)
  }

  const confirmMessage = timer.selectedSubject
    ? `${timer.selectedSubject} 用时 ${timer.formattedTime}`
    : ''

  return (
    <div className="timer-panel">
      <div className="timer-panel__header-row">
        <span className="timer-panel__name">{userName}</span>
        <TimerDisplay time={timer.formattedTime} isRunning={isRunning} isPaused={isPaused} />
      </div>

      {error && <div className="timer-panel__error">{error}</div>}

      <div className="subject-grid">
        {SUBJECTS.map(s => (
          <SubjectButton
            key={s}
            subject={s}
            selected={timer.selectedSubject === s}
            disabled={isRunning}
            onClick={handleSubjectClick}
          />
        ))}
      </div>

      <TimerDisplay time={timer.formattedTime} isRunning={isRunning} isPaused={isPaused} />

      <div className="action-buttons">
        {timer.status === 'subjectSelected' && (
          <button className="btn btn--primary btn--large" onClick={handleStart}>
            开始
          </button>
        )}
        {isTiming && (
          <div className="action-buttons__row">
            <button className="btn btn--secondary btn--large action-buttons__half" onClick={timer.pause}>
              暂停
            </button>
            <button className="btn btn--danger btn--large action-buttons__half" onClick={handleComplete}>
              完成
            </button>
          </div>
        )}
        {isPaused && (
          <div className="action-buttons__row">
            <button className="btn btn--primary btn--large action-buttons__half" onClick={timer.resume}>
              继续
            </button>
            <button className="btn btn--danger btn--large action-buttons__half" onClick={handleComplete}>
              完成
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="确认完成"
        message={confirmMessage}
        onConfirm={handleConfirmComplete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
