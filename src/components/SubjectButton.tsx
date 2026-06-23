import { Subject, SUBJECT_COLORS, SUBJECT_ICONS } from '../types'

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
      <span className="subject-btn__icon" style={{ background: SUBJECT_COLORS[subject] }}>
        {SUBJECT_ICONS[subject]}
      </span>
      {subject}
    </button>
  )
}
