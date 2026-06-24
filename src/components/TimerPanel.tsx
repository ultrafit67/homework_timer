import { useState, useMemo } from 'react'
import { Subject, Grade, GRADES, USERS, getSubjectsForGrade } from '../types'
import { useTimer } from '../hooks/useTimer'
import { SubjectButton } from './SubjectButton'
import { TimerDisplay } from './TimerDisplay'
import { ConfirmDialog } from './ConfirmDialog'
import { HomeworkRecord } from '../types'
import { addRecord, renameUserRecords } from '../db'
import { loadGrade, saveGrade, saveUserName } from '../utils'

interface TimerPanelProps {
  userIndex: number
  userName: string
  onRecordAdded: (record?: HomeworkRecord) => void
  onUserConfigChange?: () => void
}

export function TimerPanel({ userIndex, userName, onRecordAdded, onUserConfigChange }: TimerPanelProps) {
  const timer = useTimer(userName)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editName, setEditName] = useState('')
  const [grade, setGrade] = useState<number>(() => loadGrade(userIndex))
  const [error, setError] = useState<string | null>(null)

  const subjects = useMemo(() => getSubjectsForGrade(grade as Grade | 0), [grade])

  const isTiming = timer.status === 'timing'
  const isPaused = timer.status === 'paused'
  const isRunning = isTiming || isPaused

  const handleStart = () => { timer.start() }

  const handleComplete = () => { setShowConfirm(true) }

  const handleConfirmComplete = async () => {
    setShowConfirm(false)
    try {
      const record = timer.complete()
      if (record) {
        await addRecord(record)
        onRecordAdded(record)
      }
    } catch (e) {
      console.error('Failed to save record', e)
      setError('保存失败，请重试')
    }
  }

  const handleSubjectClick = (subject: Subject) => {
    timer.selectSubject(subject)
  }

  const openConfig = () => {
    setEditName(userName)
    setShowConfig(true)
  }

  const handleConfigSave = async (newGrade: number) => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== userName) {
      await renameUserRecords(userName, trimmed)
      saveUserName(userIndex, trimmed)
    }
    saveGrade(userIndex, newGrade)
    setGrade(newGrade)
    setShowConfig(false)
    onUserConfigChange?.()
  }

  const handleConfigReset = () => {
    saveUserName(userIndex, USERS[userIndex])
    saveGrade(userIndex, 0)
    setEditName(USERS[userIndex])
    setGrade(0)
    setShowConfig(false)
    onUserConfigChange?.()
  }

  const confirmMessage = timer.selectedSubject
    ? `${timer.selectedSubject} 用时 ${timer.formattedTime}`
    : ''

  return (
    <div className="timer-panel">
      <div className="timer-panel__name-row">
        <span className="timer-panel__name" onClick={openConfig}>
          {userName}
          {grade > 0 && <span className="timer-panel__grade-badge">{grade}年级</span>}
        </span>
      </div>
      <TimerDisplay time={timer.formattedTime} isRunning={isRunning} isPaused={isPaused} />

      {error && <div className="timer-panel__error">{error}</div>}

      <div className="subject-grid">
        {subjects.map(s => (
          <SubjectButton
            key={s}
            subject={s}
            selected={timer.selectedSubject === s}
            disabled={isRunning}
            onClick={handleSubjectClick}
          />
        ))}
      </div>

      <div className="action-buttons">
        {timer.status === 'subjectSelected' && (
          <button className="btn btn--primary btn--large" onClick={handleStart}>开始</button>
        )}
        {isTiming && (
          <div className="action-buttons__row">
            <button className="btn btn--secondary btn--large action-buttons__half" onClick={timer.pause}>暂停</button>
            <button className="btn btn--danger btn--large action-buttons__half" onClick={handleComplete}>完成</button>
          </div>
        )}
        {isPaused && (
          <div className="action-buttons__row">
            <button className="btn btn--primary btn--large action-buttons__half" onClick={timer.resume}>继续</button>
            <button className="btn btn--danger btn--large action-buttons__half" onClick={handleComplete}>完成</button>
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

      {showConfig && (
        <div className="dialog-overlay" onClick={() => setShowConfig(false)}>
          <div className="dialog dialog--config" onClick={e => e.stopPropagation()}>
            <h3 className="dialog__title">姓名/年级设置</h3>

            <div className="dialog__field">
              <label className="dialog__label">姓名</label>
              <input
                type="text"
                className="dialog__input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={10}
                autoFocus
              />
            </div>

                <div className="dialog__field">
                 <label className="dialog__label">年级</label>
                 <div className="grade-grid">
                   <button
                     className={`grade-btn ${grade === 0 ? 'grade-btn--active' : ''}`}
                     onClick={() => setGrade(0)}
                   >
                     全部
                   </button>
                   {GRADES.map(g => (
                     <button
                       key={g}
                       className={`grade-btn ${grade === g ? 'grade-btn--active' : ''}`}
                       onClick={() => setGrade(g)}
                     >
                       {g}年级
                     </button>
                   ))}
                 </div>
               </div>

               <div className="dialog__actions">
                 <button className="btn btn--secondary" onClick={() => setShowConfig(false)}>取消</button>
                 <button className="btn btn--primary" onClick={() => handleConfigSave(grade)}>保存</button>
               </div>

               <button className="dialog__reset" onClick={handleConfigReset}>
                 重置默认值
               </button>
           </div>
        </div>
      )}
    </div>
  )
}
