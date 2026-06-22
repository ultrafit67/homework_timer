interface TotalTimeCardProps {
  label: string
  totalSeconds: number
}

export function TotalTimeCard({ label, totalSeconds }: TotalTimeCardProps) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const display = h > 0 ? `${h}时${m}分${s}秒` : m > 0 ? `${m}分${s}秒` : `${s}秒`

  return (
    <div className="total-card">
      <div className="total-card__label">{label}</div>
      <div className="total-card__time">{display}</div>
    </div>
  )
}
