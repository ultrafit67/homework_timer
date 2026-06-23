import { useState, useRef } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordItem } from '../components/RecordItem'
import { EditRecordDialog } from '../components/EditRecordDialog'
import * as db from '../db'
import { SUBJECTS, Subject, HomeworkRecord, USERS } from '../types'

const PAGE_SIZE = 20

export function RecordsView() {
  const { records, loading, deleteRecord, updateRecord, filterBySubject, subjectFilter, userFilter, filterByUser, refresh } = useRecords()
  const [page, setPage] = useState(0)
  const [editingRecord, setEditingRecord] = useState<HomeworkRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleExport = async () => {
    try {
      const all = await db.getAllRecords()
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
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
      if (!Array.isArray(data)) throw new Error('格式错误')
      await db.importRecords(data)
      await refresh()
      setImportMsg(`成功导入 ${data.length} 条记录`)
    } catch (e) {
      setImportMsg('导入失败：文件格式不正确')
      console.error('导入失败', e)
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  if (loading) {
    return <div className="page"><p className="loading-text">加载中...</p></div>
  }

  const sortedRecords = [...records].sort(
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
        {USERS.map(u => (
          <button
            key={u}
            className={`user-tabs__tab ${userFilter === u ? 'user-tabs__tab--active' : ''}`}
            onClick={() => { filterByUser(u); setPage(0) }}
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
        {SUBJECTS.map(s => (
          <button
            key={s}
            className={`filter-bar__btn ${subjectFilter === s ? 'filter-bar__btn--active' : ''}`}
            onClick={() => handleFilter(s)}
          >
            {s}
          </button>
        ))}
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        {importMsg && <p className="data-io__msg">{importMsg}</p>}
      </div>
    </div>
  )
}
