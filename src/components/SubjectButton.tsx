import { Subject } from '../types'

interface SubjectButtonProps {
  subject: Subject
  selected: boolean
  disabled: boolean
  onClick: (subject: Subject) => void
}

const SUBJECT_COLORS: Record<Subject, string> = {
  '语文': '#EF4444',
  '数学': '#3B82F6',
  '英语': '#10B981',
  '道法': '#F59E0B',
  '历史': '#8B5CF6',
  '物理': '#EC4899',
  '化学': '#06B6D4'
}

export function SubjectButton({ subject, selected, disabled, onClick }: SubjectButtonProps) {
  return (
    <button
      className={`subject-btn ${selected ? 'subject-btn--selected' : ''}`}
      style={{
        '--subject-color': SUBJECT_COLORS[subject],
        opacity: disabled && !selected ? 0.5 : 1
      } as React.CSSProperties}
      onClick={() => onClick(subject)}
      disabled={disabled && !selected}
    >
      {subject}
    </button>
  )
}
