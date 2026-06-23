import { HomeworkRecord, SUBJECT_COLORS, SUBJECT_ICONS } from '../types'
import { formatTime, formatDuration } from '../utils'

interface RecordItemProps {
  record: HomeworkRecord
  onDelete: (id: string) => void
  onEdit: (record: HomeworkRecord) => void
}

export function RecordItem({ record, onDelete, onEdit }: RecordItemProps) {
  return (
    <div className="record-item">
      <div
        className="record-item__subject"
        style={{ backgroundColor: SUBJECT_COLORS[record.subject] }}
      >
        <span className="record-item__subject-icon">{SUBJECT_ICONS[record.subject]}</span>
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
