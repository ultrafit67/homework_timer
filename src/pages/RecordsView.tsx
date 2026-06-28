import { useState, useRef, useMemo, useEffect } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordItem } from '../components/RecordItem'
import { EditRecordDialog } from '../components/EditRecordDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AIAnalysis } from '../components/AIAnalysis'
import * as db from '../db'
import { SUBJECTS, Subject, HomeworkRecord, SUBJECT_COLORS, getSubjectsForGrade } from '../types'
import {
  loadUserNames, saveUserName, loadGrade, saveGrade, generateId,
  getAutoBackupConfig, saveAutoBackupConfig,
  getBackupList, addBackup, deleteBackup, cleanOldBackups, loadBackupData,
  AutoBackupConfig, BackupEntry,
  loadDirHandle, persistDirHandle, saveBackupDirName, getBackupDirName,
  writeBackupToDir, cleanOldBackupFiles, supportsFileSystemAPI
} from '../utils'

const PAGE_SIZE = 20

export function RecordsView() {
  const { records, loading, deleteRecord, updateRecord, filterBySubject, subjectFilter, userFilter, filterByUser, refresh } = useRecords()
  const [page, setPage] = useState(0)
  const [editingRecord, setEditingRecord] = useState<HomeworkRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showPrivacy, setShowPrivacy] = useState(false)

  const handleExport = async () => {
    try {
      const all = await db.getAllRecords()
      const names = loadUserNames()
      const grades = [loadGrade(0), loadGrade(1)]
      const data = { version: 2, records: all, userNames: names, userGrades: grades }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const localDate = new Date()
      const y = localDate.getFullYear()
      const m = String(localDate.getMonth() + 1).padStart(2, '0')
      const d = String(localDate.getDate()).padStart(2, '0')
      const hh = String(localDate.getHours()).padStart(2, '0')
      const mm = String(localDate.getMinutes()).padStart(2, '0')
      const ss = String(localDate.getSeconds()).padStart(2, '0')
      a.download = `homework-records-${y}-${m}-${d}_${hh}${mm}${ss}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('导出失败', e)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      let records: HomeworkRecord[]
      let names: string[] | undefined
      let grades: number[] | undefined

      if (Array.isArray(data)) {
        records = data
      } else if (data.version === 2) {
        records = data.records
        names = data.userNames
        grades = data.userGrades
      } else {
        throw new Error('格式错误')
      }

      const result = await db.importRecords(records)
      // Import user config
      if (names) {
        for (let i = 0; i < names.length && i < 2; i++) {
          saveUserName(i, names[i])
        }
      }
      if (grades) {
        for (let i = 0; i < grades.length && i < 2; i++) {
          saveGrade(i, grades[i])
        }
      }
      await refresh()
      if (result.skipped > 0) {
        setImportMsg(`成功导入 ${result.imported} 条，跳过 ${result.skipped} 条重复记录`)
      } else {
        setImportMsg(`成功导入 ${result.imported} 条记录`)
      }
    } catch (e) {
      setImportMsg('导入失败：文件格式不正确')
      console.error('导入失败', e)
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const handleRestore = async () => {
    setImportMsg(null)
    try {
      const count = await db.restoreFromBackup()
      await refresh()
      setImportMsg(`已从备份恢复 ${count} 条记录`)
    } catch (e) {
      setImportMsg('恢复失败：' + ((e as Error).message || '读取备份出错'))
      console.error('恢复备份失败', e)
    }
  }

  const handleClearAll = async () => {
    setShowClearConfirm(false)
    setImportMsg(null)
    try {
      await db.clearAllRecords()
      await refresh()
      setImportMsg('已清除所有记录')
    } catch (e) {
      setImportMsg('清除失败')
      console.error('清除记录失败', e)
    }
  }

  // Auto backup
  const [backupConfig, setBackupConfig] = useState<AutoBackupConfig>(() => getAutoBackupConfig())
  const [backupList, setBackupList] = useState<BackupEntry[]>(() => getBackupList())
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [backupExpanded, setBackupExpanded] = useState(false)
  const [backupDir, setBackupDir] = useState<string>(() => getBackupDirName())
  const [backupDirHandle, setBackupDirHandle] = useState<FileSystemDirectoryHandle | null>(null)

  // Restore directory handle on mount
  useEffect(() => {
    loadDirHandle().then(handle => {
      if (handle) {
        setBackupDirHandle(handle)
        setBackupDir(getBackupDirName())
      }
    })
  }, [])

  const refreshBackupList = () => setBackupList(getBackupList())

  const handleSelectBackupDir = async () => {
    try {
      const parentHandle = await (window as any).showDirectoryPicker({ startIn: 'desktop', mode: 'readwrite' })
      // Create a dedicated subfolder for backups
      let dirHandle: FileSystemDirectoryHandle
      try {
        dirHandle = await parentHandle.getDirectoryHandle('homework-timer-backup', { create: true })
      } catch {
        dirHandle = parentHandle
      }
      await persistDirHandle(dirHandle)
      setBackupDirHandle(dirHandle)
      saveBackupDirName(`homework-timer-backup (${parentHandle.name})`)
      setBackupDir(`homework-timer-backup (${parentHandle.name})`)
      setBackupMsg(`已选择备份目录：${parentHandle.name}/homework-timer-backup`)
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') {
        setBackupMsg('选择失败，请先在桌面新建一个空文件夹（如「作业备份」），再选择它')
      }
    }
  }

  const handleBackupNow = async () => {
    setBackupMsg(null)
    try {
      const all = await db.getAllRecords()
      const names = loadUserNames()
      const grades = [loadGrade(0), loadGrade(1)]
      const data = { version: 2, records: all, userNames: names, userGrades: grades }
      const id = generateId()
      const timestamp = new Date().toISOString()
      const json = JSON.stringify(data)
      addBackup(id, timestamp, json)
      cleanOldBackups(backupConfig.keepCount)
      // Also write to filesystem if directory selected
      if (backupDirHandle) {
        await writeBackupToDir(backupDirHandle, id, timestamp, json)
        await cleanOldBackupFiles(backupDirHandle, backupConfig.keepCount)
      }
      refreshBackupList()
      setBackupMsg('备份成功')
    } catch (e) {
      setBackupMsg('备份失败：' + ((e as Error).message || ''))
    }
  }

  const handleDownloadBackup = (id: string) => {
    const raw = loadBackupData(id)
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const entry = backupList.find(e => e.id === id)
    let label = 'backup'
    if (entry) {
      const t = new Date(entry.timestamp)
      label = `${entry.date}_${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`
    }
    a.download = `homework-auto-backup-${label}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDeleteBackup = (id: string) => {
    deleteBackup(id)
    refreshBackupList()
  }

  // Filter subjects by selected user's grade
  const availableSubjects = useMemo(() => {
    if (!userFilter) return SUBJECTS
    const userIndex = loadUserNames().indexOf(userFilter)
    if (userIndex === -1) return SUBJECTS
    const grade = loadGrade(userIndex)
    return getSubjectsForGrade(grade as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
  }, [userFilter])

  if (loading) {
    return <div className="page"><p className="loading-text">加载中...</p></div>
  }

  const dateFilteredRecords = records.filter(r => {
    if (dateFrom && r.date < dateFrom) return false
    if (dateTo && r.date > dateTo) return false
    return true
  })

  const sortedRecords = [...dateFilteredRecords].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )

  const totalPages = Math.ceil(sortedRecords.length / PAGE_SIZE)
  const pageRecords = sortedRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleFilter = (subject: Subject | null) => {
    filterBySubject(subject)
    setPage(0)
  }

  return (
    <div className="page records-page">
      <h2 className="page__title">记录</h2>

      <div className="user-tabs">
        <button
          className={`user-tabs__tab ${userFilter === null ? 'user-tabs__tab--active' : ''}`}
          onClick={() => { filterByUser(null); filterBySubject(null); setPage(0) }}
        >
          全部
        </button>
        {loadUserNames().map(u => (
          <button
            key={u}
            className={`user-tabs__tab ${userFilter === u ? 'user-tabs__tab--active' : ''}`}
            onClick={() => { filterByUser(u); filterBySubject(null); setPage(0) }}
          >
            {u}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <button
          className={`filter-bar__btn ${subjectFilter === null ? 'filter-bar__btn--active' : ''}`}
          onClick={() => handleFilter(null)}
        >
          全部
        </button>
        {availableSubjects.map(s => (
          <button
            key={s}
            className={`filter-bar__btn ${subjectFilter === s ? 'filter-bar__btn--active' : ''}`}
            style={subjectFilter === s ? { background: SUBJECT_COLORS[s], borderColor: SUBJECT_COLORS[s] } : { borderColor: SUBJECT_COLORS[s] }}
            onClick={() => handleFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="date-range">
        <span className="date-range__field">
          <span className="date-range__label">开始</span>
          <input type="date" required className="date-range__input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} />
        </span>
        <span className="date-range__field">
          <span className="date-range__label">结束</span>
          <input type="date" required className="date-range__input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} />
        </span>
        {(dateFrom || dateTo) && (
          <button className="date-range__clear" onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}>清除</button>
        )}
      </div>

      <AIAnalysis
        records={dateFilteredRecords}
        userFilter={userFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {pageRecords.length === 0 ? (
        <p className="empty-text">暂无记录</p>
      ) : (
        <>
          <div className="record-list">
            {pageRecords.map(r => (
              <RecordItem key={r.id} record={r} onDelete={deleteRecord} onEdit={setEditingRecord} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn--small"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </button>
              <span className="pagination__info">{page + 1} / {totalPages}</span>
              <button
                className="btn btn--small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {editingRecord && (
        <EditRecordDialog
          record={editingRecord}
          onSave={async (updated) => {
            await updateRecord(updated)
            setEditingRecord(null)
          }}
          onCancel={() => setEditingRecord(null)}
        />
      )}

      <div className="data-io">
        <button className="btn btn--text" onClick={handleExport}>导出数据</button>
        <button className="btn btn--text" onClick={() => fileInputRef.current?.click()}>导入数据</button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button className="btn btn--text" onClick={handleRestore}>从备份恢复</button>
        <button className="btn btn--text btn--text-danger" onClick={() => setShowClearConfirm(true)}>清除所有记录</button>
        <button className="btn btn--text" onClick={() => setShowPrivacy(true)}>隐私声明</button>
        {importMsg && <p className="data-io__msg">{importMsg}</p>}
      </div>

      <div className="auto-backup">
        <div className="auto-backup__header" onClick={() => setBackupExpanded(!backupExpanded)}>
          <span className="auto-backup__title">自动备份</span>
          <span className="auto-backup__toggle">{backupExpanded ? '收起' : backupConfig.enabled ? '已开启' : '已关闭'}</span>
        </div>
        <div className="auto-backup__body" style={{ display: backupExpanded ? 'block' : 'none' }}>
          <div className="auto-backup__row">
            <label className="auto-backup__label">启用</label>
            <label className="auto-backup__switch">
              <input type="checkbox" checked={backupConfig.enabled} onChange={e => {
                const next = { ...backupConfig, enabled: e.target.checked }
                setBackupConfig(next)
                saveAutoBackupConfig(next)
              }} />
              <span className="auto-backup__slider" />
            </label>
          </div>
          <div className="auto-backup__row">
            <label className="auto-backup__label">备份时间</label>
            <input type="time" className="auto-backup__input" value={backupConfig.time} onChange={e => {
              const next = { ...backupConfig, time: e.target.value }
              setBackupConfig(next)
              saveAutoBackupConfig(next)
            }} />
          </div>
          <div className="auto-backup__row">
            <label className="auto-backup__label">保留份数</label>
            <input type="number" className="auto-backup__input auto-backup__input--narrow" min={1} max={100} value={backupConfig.keepCount} onChange={e => {
              const next = { ...backupConfig, keepCount: Math.max(1, parseInt(e.target.value) || 1) }
              setBackupConfig(next)
              saveAutoBackupConfig(next)
            }} />
          </div>
          <div className="auto-backup__row">
            <label className="auto-backup__label">备份目录</label>
            {backupDir ? (
              <span className="auto-backup__dir-name">{backupDir}</span>
            ) : supportsFileSystemAPI() ? (
              <span className="auto-backup__dir-hint">未设置</span>
            ) : (
              <span className="auto-backup__dir-hint">浏览器不支持</span>
            )}
          </div>
          {supportsFileSystemAPI() && (
            <div className="auto-backup__center">
              <button className="btn btn--text" onClick={handleSelectBackupDir}>
                {backupDir ? '更换备份目录' : '选择备份目录'}
              </button>
              {!backupDir && (
                <p className="auto-backup__dir-tip">提示：请先在桌面新建一个空文件夹</p>
              )}
            </div>
          )}
          <div className="auto-backup__center">
            <button className="btn btn--text" onClick={handleBackupNow}>立即备份</button>
          </div>
          {backupMsg && <p className="auto-backup__msg">{backupMsg}</p>}
          {backupList.length > 0 && (
            <div className="auto-backup__list">
              {[...backupList].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(e => (
                <div key={e.id} className="auto-backup__item">
                  <span className="auto-backup__item-date">{e.date}</span>
                  <span className="auto-backup__item-time">{new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <button className="auto-backup__item-dl" onClick={() => handleDownloadBackup(e.id)}>下载</button>
                  <button className="auto-backup__item-del" onClick={() => handleDeleteBackup(e.id)}>删除</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        title="清除所有记录"
        message="确定要清除所有记录吗？此操作不可恢复！"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      {showPrivacy && (
        <div className="dialog-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={{maxWidth:'360px'}}>
            <div className="dialog__title">隐私声明</div>
            <div className="dialog__message" style={{textAlign:'left', fontSize:'14px'}}>
              <p style={{marginBottom:'12px'}}>本应用重视您的隐私。</p>
              <p style={{marginBottom:'12px'}}>所有数据（作业记录、设置等）仅存储在您设备的本地数据库（IndexedDB）中，<strong>不会上传到任何服务器</strong>。</p>
              <p style={{marginBottom:'12px'}}>备份文件导出后保存在您指定的本地目录或下载到您的设备，不会被应用自动上传。</p>
              <p style={{marginBottom:'12px'}}><strong>AI 分析</strong>功能需要您自行配置 API Key，分析请求直接发送至 DeepSeek API。传输内容仅包含科目的学习时长统计，不包含您的姓名、年级等个人信息。</p>
              <p>我们不会以任何方式收集、存储或分享您的个人数据。</p>
            </div>
            <div className="dialog__actions">
              <button className="btn btn--primary" onClick={() => setShowPrivacy(false)}>知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
