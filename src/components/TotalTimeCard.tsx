import { formatDuration } from '../utils'

interface TotalTimeCardProps {
  label: string
  totalSeconds: number
}

export function TotalTimeCard({ label, totalSeconds }: TotalTimeCardProps) {
  const display = formatDuration(totalSeconds)

  return (
    <div className="total-card">
      <div className="total-card__label">{label}</div>
      <div className="total-card__time">{display}</div>
    </div>
  )
}
