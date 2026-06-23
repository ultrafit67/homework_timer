import { HomeworkRecord } from '../types'
import { formatTime, formatDuration } from '../utils'

interface RecordItemProps {
  record: HomeworkRecord
  onDelete: (id: string) => void
  onEdit: (record: HomeworkRecord) => void
}

const SUBJECT_COLORS: Record<string, string> = {
  '语文': '#EF4444',
  '数学': '#3B82F6',
  '英语': '#10B981',
  '道法': '#F59E0B',
  '历史': '#8B5CF6',
  '物理': '#EC4899',
  '化学': '#06B6D4'
}

export function RecordItem({ record, onDelete, onEdit }: RecordItemProps) {
  return (
    <div className="record-item">
      <div className="record-item__subject" style={{ backgroundColor: SUBJECT_COLORS[record.subject] }}>
        {record.subject}
      </div>
      <div className="record-item__user">{record.user}</div>
      <div className="record-item__body">
        <div className="record-item__date">{record.date}</div>
        <div className="record-item__time-range">
          {formatTime(record.startTime)} - {formatTime(record.endTime)}
        </div>
        <div className="record-item__duration">{formatDuration(record.durationSeconds)}</div>
      </div>
      <button
        className="record-item__edit"
        onClick={() => onEdit(record)}
      >
        ✎
      </button>
      <button
        className="record-item__delete"
        onClick={() => {
          if (confirm('确认删除此记录？')) {
            onDelete(record.id)
          }
        }}
      >
        ✕
      </button>
    </div>
  )
}
