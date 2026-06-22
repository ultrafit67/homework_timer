import { Subject } from '../types'

interface RankingItemProps {
  subject: Subject
  totalSeconds: number
  count: number
  rank: number
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

export function RankingItem({ subject, totalSeconds, count, rank }: RankingItemProps) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const display = h > 0 ? `${h}小时${m}分${s}秒` : m > 0 ? `${m}分${s}秒` : `${s}秒`
  const barPercent = Math.min(100, (totalSeconds / 7200) * 100) // max 2 hours = 100%

  return (
    <div className="ranking-item">
      <div className="ranking-item__rank">#{rank}</div>
      <div className="ranking-item__subject" style={{ color: SUBJECT_COLORS[subject] }}>
        {subject}
      </div>
      <div className="ranking-item__info">
        <div className="ranking-item__time">{display}</div>
        <div className="ranking-item__count">{count}次</div>
      </div>
      <div className="ranking-item__bar">
        <div
          className="ranking-item__bar-fill"
          style={{ width: `${barPercent}%`, backgroundColor: SUBJECT_COLORS[subject] }}
        />
      </div>
    </div>
  )
}
