interface TotalTimeCardProps {
  label: string
  totalSeconds: number
}

export function TotalTimeCard({ label, totalSeconds }: TotalTimeCardProps) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const display = h > 0 ? `${h}时${m}分` : `${m}分`

  return (
    <div className="total-card">
      <div className="total-card__label">{label}</div>
      <div className="total-card__time">{display}</div>
    </div>
  )
}
