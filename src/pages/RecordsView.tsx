import { useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordItem } from '../components/RecordItem'
import { EditRecordDialog } from '../components/EditRecordDialog'
import { SUBJECTS, Subject, HomeworkRecord } from '../types'

const PAGE_SIZE = 20

export function RecordsView() {
  const { records, loading, deleteRecord, updateRecord, filterBySubject, subjectFilter } = useRecords()
  const [page, setPage] = useState(0)
  const [editingRecord, setEditingRecord] = useState<HomeworkRecord | null>(null)

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
    </div>
  )
}
