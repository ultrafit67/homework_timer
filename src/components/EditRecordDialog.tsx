import { useState } from 'react'
import { HomeworkRecord, Subject, SUBJECTS, SUBJECT_COLORS, SUBJECT_ICONS } from '../types'
import { loadUserNames } from '../utils'

interface EditRecordDialogProps {
  record: HomeworkRecord
  onSave: (record: HomeworkRecord) => Promise<void>
  onCancel: () => void
}

function extractTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatPreview(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}时`)
  if (m > 0) parts.push(`${m}分`)
  parts.push(`${s}秒`)
  return parts.join('')
}

export function EditRecordDialog({ record, onSave, onCancel }: EditRecordDialogProps) {
  const [date, setDate] = useState(record.date)
  const [startTime, setStartTime] = useState(extractTime(record.startTime))
  const [endTime, setEndTime] = useState(extractTime(record.endTime))
  const [subject, setSubject] = useState<Subject>(record.subject)
  const [user, setUser] = useState(record.user)
  const [saving, setSaving] = useState(false)

  const computePreview = (): number => {
    try {
      const start = new Date(`${date}T${startTime}:00`).getTime()
      const end = new Date(`${date}T${endTime}:00`).getTime()
      if (end > start) return Math.round((end - start) / 1000)
    } catch { /* ignore invalid date/time */ }
    return 0
  }

  const previewSeconds = computePreview()

  const handleSave = async () => {
    if (!startTime || !endTime) return
    const newStartISO = new Date(`${date}T${startTime}:00`).toISOString()
    const newEndISO = new Date(`${date}T${endTime}:00`).toISOString()
    const durationSeconds = Math.round(
      (new Date(newEndISO).getTime() - new Date(newStartISO).getTime()) / 1000
    )
    if (durationSeconds <= 0) return

    setSaving(true)
    try {
      await onSave({
        ...record,
        subject,
        user,
        startTime: newStartISO,
        endTime: newEndISO,
        durationSeconds,
        date,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3 className="dialog__title">编辑记录</h3>

        <div className="dialog__field">
          <label className="dialog__label">科目</label>
          <div className="dialog__subject-group">
            {SUBJECTS.map(s => (
              <button
                key={s}
                className={`subject-btn ${subject === s ? 'subject-btn--active' : ''}`}
                style={{
                  '--subject-color': SUBJECT_COLORS[s],
                  ...(subject === s ? { background: SUBJECT_COLORS[s], borderColor: SUBJECT_COLORS[s] } : {})
                } as React.CSSProperties}
                onClick={() => setSubject(s)}
              >
                <span className="subject-btn__icon" style={{ background: SUBJECT_COLORS[s] }}>
                  {SUBJECT_ICONS[s]}
                </span>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">用户</label>
          <div className="dialog__subject-group">
            {loadUserNames().map(u => (
              <button
                key={u}
                className={`subject-btn ${user === u ? 'subject-btn--active' : ''}`}
                onClick={() => setUser(u)}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">日期</label>
          <input
            type="date"
            className="dialog__input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">开始时间</label>
          <input
            type="time"
            className="dialog__input"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">结束时间</label>
          <input
            type="time"
            className="dialog__input"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          />
        </div>

        <div className="dialog__preview">
          持续时间：{formatPreview(previewSeconds)}
        </div>

        <div className="dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || previewSeconds <= 0}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
