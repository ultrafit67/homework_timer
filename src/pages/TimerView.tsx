import { useState } from 'react'
import { SUBJECTS, Subject } from '../types'
import { useTimer } from '../hooks/useTimer'
import { SubjectButton } from '../components/SubjectButton'
import { TimerDisplay } from '../components/TimerDisplay'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { addRecord } from '../db'
import { generateId, getTodayDate } from '../utils'

interface TimerViewProps {
  onRecordAdded: () => void
}

function toLocalDatetimeString(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function toISOFromLocal(localStr: string): string {
  const d = new Date(localStr)
  return d.toISOString()
}

function calcDurationSeconds(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
}

export function TimerView({ onRecordAdded }: TimerViewProps) {
  const timer = useTimer()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualSubject, setManualSubject] = useState<Subject | null>(null)
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubjectClick = (subject: Subject) => {
    timer.selectSubject(subject)
  }

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

  const handleManualSave = async () => {
    if (!manualSubject) {
      setError('请选择科目')
      return
    }
    if (!manualStart || !manualEnd) {
      setError('请设置开始和结束时间')
      return
    }
    if (new Date(manualEnd) <= new Date(manualStart)) {
      setError('结束时间必须晚于开始时间')
      return
    }
    try {
      const startISO = toISOFromLocal(manualStart)
      const endISO = toISOFromLocal(manualEnd)
      const record = {
        id: generateId(),
        subject: manualSubject,
        startTime: startISO,
        endTime: endISO,
        durationSeconds: calcDurationSeconds(startISO, endISO),
        date: getTodayDate()
      }
      await addRecord(record)
      setShowManual(false)
      setManualSubject(null)
      setManualStart('')
      setManualEnd('')
      setError(null)
      onRecordAdded()
    } catch (e) {
      console.error('Failed to save manual record', e)
      setError('保存失败，请重试')
    }
  }

  const handleManualCancel = () => {
    setShowManual(false)
    setManualSubject(null)
    setManualStart('')
    setManualEnd('')
    setError(null)
  }

  // Pre-fill manual times with current time
  const handleOpenManual = () => {
    const now = new Date()
    const endStr = toLocalDatetimeString(now.toISOString())
    const startStr = toLocalDatetimeString(new Date(now.getTime() - 1800000).toISOString()) // 30 min ago
    setManualStart(startStr)
    setManualEnd(endStr)
    setShowManual(true)
    setError(null)
  }

  const canStart = timer.status === 'subjectSelected'
  const isRunning = timer.status === 'timing'

  const getConfirmMessage = () => {
    if (!timer.selectedSubject) return ''
    return `${timer.selectedSubject} 用时 ${timer.formattedTime}`
  }

  return (
    <div className="page timer-page">
      <h2 className="page__title">选择科目</h2>

      {!showManual ? (
        <>
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

          <TimerDisplay time={timer.formattedTime} isRunning={isRunning} />

          <div className="action-buttons">
            {!isRunning ? (
              <button
                className={`btn btn--primary btn--large ${!canStart ? 'btn--disabled' : ''}`}
                onClick={handleStart}
                disabled={!canStart}
              >
                开始
              </button>
            ) : (
              <button
                className="btn btn--danger btn--large"
                onClick={handleComplete}
              >
                完成
              </button>
            )}
          </div>

          {!isRunning && (
            <div className="manual-entry-section">
              <button className="btn btn--text btn--center" onClick={handleOpenManual}>
                手动记录
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="manual-form">
          <h3 className="manual-form__title">手动记录</h3>

          <div className="manual-form__field">
            <label className="manual-form__label">科目</label>
            <div className="subject-grid subject-grid--small">
              {SUBJECTS.map(s => (
                <SubjectButton
                  key={s}
                  subject={s}
                  selected={manualSubject === s}
                  disabled={false}
                  onClick={setManualSubject}
                />
              ))}
            </div>
          </div>

          <div className="manual-form__field">
            <label className="manual-form__label">开始时间</label>
            <input
              type="datetime-local"
              className="manual-form__input"
              value={manualStart}
              onChange={e => setManualStart(e.target.value)}
            />
          </div>

          <div className="manual-form__field">
            <label className="manual-form__label">结束时间</label>
            <input
              type="datetime-local"
              className="manual-form__input"
              value={manualEnd}
              onChange={e => setManualEnd(e.target.value)}
            />
            {manualStart && manualEnd && new Date(manualEnd) > new Date(manualStart) && (
              <div className="manual-form__hint">
                时长：{formatDuration(calcDurationSeconds(toISOFromLocal(manualStart), toISOFromLocal(manualEnd)))}
              </div>
            )}
          </div>

          {error && <div className="manual-form__error">{error}</div>}

          <div className="manual-form__actions">
            <button className="btn btn--secondary btn--large" onClick={handleManualCancel}>
              取消
            </button>
            <button className="btn btn--primary btn--large" onClick={handleManualSave}>
              保存
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="确认完成"
        message={getConfirmMessage()}
        onConfirm={handleConfirmComplete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}
