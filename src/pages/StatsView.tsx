import { useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { loadUserNames } from '../utils'

export function StatsView() {
  const { dailyStats, weeklyStats, weeklyDayTotals, dailyTotal, weeklyTotal, weeklyTotals, loading, userFilter, filterByUser } = useRecords()
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const [showWeekRanking, setShowWeekRanking] = useState(false)

  if (loading) {
    return <div className="page"><p className="loading-text">加载中...</p></div>
  }

  const periodLabel = period === 'daily' ? '今日' : '本周'
  const total = period === 'daily' ? dailyTotal : weeklyTotal

  if (showWeekRanking) {
    return (
      <div className="page stats-page">
        <div className="page__header">
          <button className="btn btn--text" onClick={() => setShowWeekRanking(false)}>← 返回</button>
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

  const stats = period === 'daily' ? dailyStats : weeklyStats
  const maxSeconds = Math.max(...stats.map(s => s.totalSeconds), 1)

  const dayTotals = period === 'weekly' ? weeklyDayTotals : null
  const maxDaySeconds = Math.max(...(dayTotals?.map(d => d.totalSeconds) ?? [0]), 1)

  return (
    <div className="page stats-page">
      <h2 className="page__title">统计</h2>

      <div className="user-tabs">
        <button
          className={`user-tabs__tab ${userFilter === null ? 'user-tabs__tab--active' : ''}`}
          onClick={() => filterByUser(null)}
        >全部</button>
        {loadUserNames().map(u => (
          <button
            key={u}
            className={`user-tabs__tab ${userFilter === u ? 'user-tabs__tab--active' : ''}`}
            onClick={() => filterByUser(u)}
          >{u}</button>
        ))}
      </div>

      <div className="period-toggle">
        <button
          className={`period-toggle__btn ${period === 'daily' ? 'period-toggle__btn--active' : ''}`}
          onClick={() => setPeriod('daily')}
        >日视图</button>
        <button
          className={`period-toggle__btn ${period === 'weekly' ? 'period-toggle__btn--active' : ''}`}
          onClick={() => setPeriod('weekly')}
        >周视图</button>
      </div>

      <div className="stats-summary">
        <span className="stats-summary__value">{formatDuration(total)}</span>
        <span className="stats-summary__label">{periodLabel}总用时</span>
      </div>

      {/* Subject bar chart (daily + weekly) */}
      {stats.length > 0 && (
        <div className="chart-section">
          <h3 className="chart-section__title">{period === 'daily' ? '科目用时' : '科目用时'}</h3>
          <div className="chart-bars">
            {stats.map(stat => (
              <div key={stat.subject} className="chart-bar-row">
                <span className="chart-bar-row__label">{stat.subject}</span>
                <div className="chart-bar-row__track">
                  <div
                    className="chart-bar-row__fill"
                    style={{ width: `${(stat.totalSeconds / maxSeconds) * 100}%` }}
                  />
                </div>
                <span className="chart-bar-row__value">{formatDuration(stat.totalSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly per-day bar chart */}
      {period === 'weekly' && dayTotals && dayTotals.some(d => d.totalSeconds > 0) && (
        <div className="chart-section">
          <h3 className="chart-section__title">每日用时</h3>
          <div className="chart-bars chart-bars--days">
            {dayTotals.map(d => (
              <div key={d.date} className="chart-bar-row">
                <span className="chart-bar-row__label">{d.label}</span>
                <div className="chart-bar-row__track">
                  <div
                    className="chart-bar-row__fill chart-bar-row__fill--alt"
                    style={{ width: `${(d.totalSeconds / maxDaySeconds) * 100}%` }}
                  />
                </div>
                <span className="chart-bar-row__value">{d.totalSeconds > 0 ? formatDuration(d.totalSeconds) : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length === 0 && (!dayTotals || !dayTotals.some(d => d.totalSeconds > 0)) && (
        <p className="empty-text">{periodLabel}暂无作业记录</p>
      )}

      {period === 'weekly' && weeklyTotals.length > 0 && (
        <button className="btn btn--text btn--center" onClick={() => setShowWeekRanking(true)}>
          查看每周总用时排行 →
        </button>
      )}
    </div>
  )
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}
