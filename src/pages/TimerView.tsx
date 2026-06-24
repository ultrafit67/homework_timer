import { useState, useMemo } from 'react'
import { HomeworkRecord, Subject, getSubjectsForGrade } from '../types'
import { TimerPanel } from '../components/TimerPanel'
import { SubjectButton } from '../components/SubjectButton'
import { addRecord } from '../db'
import { generateId, loadGrade, loadUserNames, formatDuration, formatDate } from '../utils'

interface TimerViewProps {
  onRecordAdded: (record?: HomeworkRecord) => void
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
  const [showManual, setShowManual] = useState(false)
  const [showUsage, setShowUsage] = useState(false)
  const [users, setUsers] = useState<string[]>(() => loadUserNames())
  const [manualUserIdx, setManualUserIdx] = useState<number>(0)
  const [manualSubject, setManualSubject] = useState<Subject | null>(null)
  const [manualMode, setManualMode] = useState<'exact' | 'quick'>('exact')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualMinutes, setManualMinutes] = useState(30)
  const [error, setError] = useState<string | null>(null)

  const handleUserConfigChange = () => {
    setUsers(loadUserNames())
  }

  const manualSubjects = useMemo(() => {
    const grade = loadGrade(manualUserIdx)
    return getSubjectsForGrade(grade as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
  }, [manualUserIdx])

  if (manualSubject && !manualSubjects.includes(manualSubject)) {
    setManualSubject(null)
  }

  const handleManualSave = async () => {
    if (!manualSubject) {
      setError('请选择科目')
      return
    }
    let startISO: string
    let endISO: string
    let durationSeconds: number

    if (manualMode === 'quick') {
      if (!manualMinutes || manualMinutes < 1) {
        setError('请输入有效分钟数')
        return
      }
      const now = new Date()
      const start = new Date(now.getTime() - manualMinutes * 60000)
      startISO = start.toISOString()
      endISO = now.toISOString()
      durationSeconds = manualMinutes * 60
    } else {
      if (!manualStart || !manualEnd) {
        setError('请设置开始和结束时间')
        return
      }
      if (new Date(manualEnd) <= new Date(manualStart)) {
        setError('结束时间必须晚于开始时间')
        return
      }
      startISO = toISOFromLocal(manualStart)
      endISO = toISOFromLocal(manualEnd)
      durationSeconds = calcDurationSeconds(startISO, endISO)
    }

    try {
      const record = {
        id: generateId(),
        subject: manualSubject,
        startTime: startISO,
        endTime: endISO,
        durationSeconds,
        date: formatDate(new Date(startISO)),
        user: users[manualUserIdx]
      }
      await addRecord(record)
      setShowManual(false)
      setManualSubject(null)
      setManualStart('')
      setManualEnd('')
      setError(null)
      onRecordAdded(record)
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

  const handleOpenManual = () => {
    const now = new Date()
    const endStr = toLocalDatetimeString(now.toISOString())
    const startStr = toLocalDatetimeString(new Date(now.getTime() - 1800000).toISOString())
    setManualStart(startStr)
    setManualEnd(endStr)
    setShowManual(true)
    setError(null)
  }

  return (
    <div className="page timer-page">
      <div className="page__header">
        <h2 className="page__title">家庭作业计时器</h2>
      </div>
      {!showManual ? (
        <>
          <div className="timer-panels">
            <TimerPanel
              userIndex={0}
              userName={users[0]}
              onRecordAdded={onRecordAdded}
              onUserConfigChange={handleUserConfigChange}
            />
            <TimerPanel
              userIndex={1}
              userName={users[1]}
              onRecordAdded={onRecordAdded}
              onUserConfigChange={handleUserConfigChange}
            />
          </div>
          <div className="timer-page__footer">
            <span className="manual-link" onClick={handleOpenManual}>
              手动记录
            </span>
            <span className="usage-link" onClick={() => setShowUsage(true)}>
              遇到问题？查看使用方法
            </span>
          </div>
        </>
      ) : (
        <div className="manual-form">
          <h3 className="manual-form__title">手动记录</h3>

          <div className="manual-form__field">
            <label className="manual-form__label">姓名</label>
            <div className="user-tabs">
              {users.map((u, i) => (
                <button
                  key={i}
                  className={`user-tabs__tab ${manualUserIdx === i ? 'user-tabs__tab--active' : ''}`}
                  onClick={() => setManualUserIdx(i)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="manual-form__field">
            <label className="manual-form__label">科目</label>
            <div className="subject-grid subject-grid--small">
              {manualSubjects.map(s => (
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

          <div className="manual-form__mode-toggle">
            <button
              className={`manual-form__mode-btn ${manualMode === 'exact' ? 'manual-form__mode-btn--active' : ''}`}
              onClick={() => setManualMode('exact')}
            >精确时间</button>
            <button
              className={`manual-form__mode-btn ${manualMode === 'quick' ? 'manual-form__mode-btn--active' : ''}`}
              onClick={() => setManualMode('quick')}
            >快速录入</button>
          </div>

          {manualMode === 'exact' ? (
            <div className="manual-form__time-row">
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
            </div>
          ) : (
            <div className="manual-form__field">
              <label className="manual-form__label">时长（分钟）</label>
              <input
                type="number"
                className="manual-form__input"
                min={1}
                max={1440}
                value={manualMinutes}
                onChange={e => setManualMinutes(Math.max(1, parseInt(e.target.value) || 0))}
              />
              <div className="manual-form__hint">以当前时间为结束时间，向前推算</div>
            </div>
          )}

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

      {showUsage && (
        <div className="dialog-overlay" onClick={() => setShowUsage(false)}>
          <div className="dialog dialog--usage" onClick={e => e.stopPropagation()}>
            <h3 className="dialog__title">使用方法</h3>
            <div className="dialog__body usage-guide">
              <section>
                <h4>修改姓名/年级</h4>
                <p>点击计时面板顶部的姓名，在弹出的对话框中修改姓名和年级。修改姓名会自动更新历史记录中该姓名的所有记录。</p>
              </section>
              <section>
                <h4>手动记录</h4>
                <p>点击计时页面的「手动记录」按钮，选择姓名、科目后，可精确输入起止时间或使用快速录入（输入分钟数，以当前时间回推）。</p>
              </section>
              <section>
                <h4>本地扫码同步</h4>
                <p>两台手机连接到同一 WiFi，点击计时页面的 QR 图标 →「发起同步」生成二维码，另一台点「扫描同步」扫码配对，自动交换数据。同步包含记录和姓名配置（姓名/年级）。</p>
              </section>
              <section>
                <h4>数据导入/导出</h4>
                <p>在「记录」页面底部，点击「导出数据」下载 JSON 文件，包含所有作业记录和姓名配置。导入时选择之前导出的文件即可恢复。</p>
              </section>
              <section>
                <h4>清除所有记录</h4>
                <p>在「记录」页面底部点击「清除所有记录」，确认后永久删除全部记录，不可恢复。</p>
              </section>
              <section>
                <h4>云同步</h4>
                <p>在「设置」页面填入腾讯云 CloudBase 环境 ID 并开启，数据自动同步到云端。局域网同步和云同步可同时使用。</p>
              </section>
            </div>
            <div className="dialog__actions">
              <button className="btn btn--primary" onClick={() => setShowUsage(false)}>知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


