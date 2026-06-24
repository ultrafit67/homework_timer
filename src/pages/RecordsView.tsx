import { useState, useRef, useMemo } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordItem } from '../components/RecordItem'
import { EditRecordDialog } from '../components/EditRecordDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import * as db from '../db'
import { SUBJECTS, Subject, HomeworkRecord, SUBJECT_COLORS, getSubjectsForGrade } from '../types'
import { loadUserNames, saveUserName, loadGrade, saveGrade } from '../utils'

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
      a.download = `homework-records-${y}-${m}-${d}.json`
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
        <input type="date" className="date-range__input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} />
        <span className="date-range__sep">~</span>
        <input type="date" className="date-range__input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} />
        {(dateFrom || dateTo) && (
          <button className="date-range__clear" onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}>清除</button>
        )}
      </div>

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
        {importMsg && <p className="data-io__msg">{importMsg}</p>}
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        title="清除所有记录"
        message="确定要清除所有记录吗？此操作不可恢复！"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  )
}
