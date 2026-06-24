import { Subject, SUBJECT_COLORS } from '../types'

interface SubjectButtonProps {
  subject: Subject
  selected: boolean
  disabled: boolean
  onClick: (subject: Subject) => void
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
