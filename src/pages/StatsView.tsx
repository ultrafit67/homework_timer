import { useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { TotalTimeCard } from '../components/TotalTimeCard'
import { RankingItem } from '../components/RankingItem'
import { PeriodType } from '../types'
import { loadUserNames } from '../utils'

export function StatsView() {
  const { dailyStats, weeklyStats, dailyTotal, weeklyTotal, weeklyTotals, loading, userFilter, filterByUser } = useRecords()
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [showWeekRanking, setShowWeekRanking] = useState(false)

  if (loading) {
    return <div className="page"><p className="loading-text">加载中...</p></div>
  }

  const stats = period === 'daily' ? dailyStats : weeklyStats
  const total = period === 'daily' ? dailyTotal : weeklyTotal
  const periodLabel = period === 'daily' ? '今日' : '本周'

  if (showWeekRanking) {
    return (
      <div className="page stats-page">
        <div className="page__header">
          <button className="btn btn--text" onClick={() => setShowWeekRanking(false)}>
            ← 返回
          </button>
          <h2 className="page__title">每周总用时排行</h2>
        </div>

        {weeklyTotals.length === 0 ? (
          <p className="empty-text">暂无数据</p>
        ) : (
          <div className="weekly-list">
            {weeklyTotals.map((item, i) => {
              const h = Math.floor(item.totalSeconds / 3600)
              const m = Math.floor((item.totalSeconds % 3600) / 60)
              const s = item.totalSeconds % 60
              return (
                <div key={item.weekId} className="weekly-item">
                  <div className="weekly-item__rank">#{i + 1}</div>
                  <div className="weekly-item__week">第{item.weekId.split('-W')[1]}周</div>
                  <div className="weekly-item__time">
                    {h > 0 ? `${h}时${m}分${s}秒` : m > 0 ? `${m}分${s}秒` : `${s}秒`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page stats-page">
      <h2 className="page__title">统计</h2>

      <div className="user-tabs">
        {loadUserNames().map(u => (
          <button
            key={u}
            className={`user-tabs__tab ${userFilter === u ? 'user-tabs__tab--active' : ''}`}
            onClick={() => filterByUser(u)}
          >
            {u}
          </button>
        ))}
      </div>

      <div className="period-toggle">
        <button
          className={`period-toggle__btn ${period === 'daily' ? 'period-toggle__btn--active' : ''}`}
          onClick={() => setPeriod('daily')}
        >
          日视图
        </button>
        <button
          className={`period-toggle__btn ${period === 'weekly' ? 'period-toggle__btn--active' : ''}`}
          onClick={() => setPeriod('weekly')}
        >
          周视图
        </button>
      </div>

      <TotalTimeCard label={`${periodLabel}作业总用时`} totalSeconds={total} />

      {stats.length === 0 ? (
        <p className="empty-text">{periodLabel}暂无作业记录</p>
      ) : (
        <div className="ranking-list">
          <h3 className="ranking-list__title">科目用时排名</h3>
          {stats.map((stat, i) => (
            <RankingItem
              key={stat.subject}
              subject={stat.subject}
              totalSeconds={stat.totalSeconds}
              count={stat.count}
              rank={i + 1}
            />
          ))}
        </div>
      )}

      {period === 'weekly' && weeklyTotals.length > 0 && (
        <button className="btn btn--text btn--center" onClick={() => setShowWeekRanking(true)}>
          查看每周总用时排行 →
        </button>
      )}
    </div>
  )
}
