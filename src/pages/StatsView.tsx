import { useState, useMemo } from 'react'
import { useRecords } from '../hooks/useRecords'
import { Subject, SUBJECT_COLORS } from '../types'
import { loadUserNames, getWeekId } from '../utils'

type PeriodType = 'daily' | 'weekly' | 'trend'
type TrendPeriod = 'weekly' | 'monthly'

interface TrendPoint {
  label: string
  subjects: { subject: Subject; totalSeconds: number }[]
  totalSeconds: number
}

const CHART_W = 500
const CHART_H = 200
const PAD = { top: 20, right: 10, bottom: 30, left: 50 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

export function StatsView() {
  const { allRecords, dailyStats, weeklyStats, weeklyDayTotals, dailyTotal, weeklyTotal, weeklyTotals, loading, userFilter, filterByUser } = useRecords()
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('weekly')
  const [showWeekRanking, setShowWeekRanking] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  if (loading) {
    return <div className="page"><p className="loading-text">加载中...</p></div>
  }

  const periodLabel = period === 'daily' ? '今日' : period === 'weekly' ? '本周' : ''
  const total = period === 'daily' ? dailyTotal : period === 'weekly' ? weeklyTotal : 0

  // === Trend data computation ===
  const trendData = useMemo<TrendPoint[]>(() => {
    if (period !== 'trend') return []

    const groups = new Map<string, Map<Subject, number>>()

    for (const r of allRecords) {
      const key = trendPeriod === 'weekly'
        ? getWeekId(r.date)
        : r.date.slice(0, 7) // YYYY-MM

      if (!groups.has(key)) groups.set(key, new Map())
      const subMap = groups.get(key)!
      subMap.set(r.subject, (subMap.get(r.subject) || 0) + r.durationSeconds)
    }

    const sorted = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))

    // Take last 12 periods
    const latest = sorted.slice(-12)

    return latest.map(([key, subMap]) => {
      let totalSec = 0
      const subjects: TrendPoint['subjects'] = []
      for (const [subject, seconds] of subMap.entries()) {
        subjects.push({ subject, totalSeconds: seconds })
        totalSec += seconds
      }
      subjects.sort((a, b) => b.totalSeconds - a.totalSeconds)

      const label = trendPeriod === 'weekly'
        ? `第${key.split('-W')[1]}周`
        : key.slice(5) + '月'

      return { label, subjects, totalSeconds: totalSec }
    })
  }, [allRecords, period, trendPeriod])

  const maxTrendHours = useMemo(() => {
    if (trendData.length === 0) return 0
    const maxSec = Math.max(...trendData.map(d => d.totalSeconds), 0)
    const maxH = Math.ceil(maxSec / 3600)
    return Math.max(maxH, 1)
  }, [trendData])

  // Collect all subjects that appear in trend data
  const trendSubjects = useMemo(() => {
    const set = new Set<Subject>()
    for (const d of trendData) {
      for (const s of d.subjects) set.add(s.subject)
    }
    return Array.from(set)
  }, [trendData])

  // === Shared chart helpers ===
  const maxSeconds = Math.max(...(period !== 'trend' ? [...dailyStats, ...weeklyStats].map(s => s.totalSeconds) : []), 1)
  const dayTotals = period === 'weekly' ? weeklyDayTotals : null
  const maxDaySeconds = Math.max(...(dayTotals?.map(d => d.totalSeconds) ?? [0]), 1)

  // === Week ranking view ===
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

  const stats = period === 'daily' ? dailyStats : period === 'weekly' ? weeklyStats : []

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
        <button
          className={`period-toggle__btn ${period === 'trend' ? 'period-toggle__btn--active' : ''}`}
          onClick={() => setPeriod('trend')}
        >趋势</button>
      </div>

      {period !== 'trend' && (
        <div className="stats-summary">
          <span className="stats-summary__value">{formatDuration(total)}</span>
          <span className="stats-summary__label">{periodLabel}总用时</span>
        </div>
      )}

      {/* Daily / Weekly subject bar chart */}
      {period !== 'trend' && stats.length > 0 && (
        <div className="chart-section">
          <h3 className="chart-section__title">科目用时</h3>
          <div className="chart-bars">
            {stats.map(stat => (
              <div key={stat.subject} className="chart-bar-row" style={{ '--subject-color': SUBJECT_COLORS[stat.subject] } as React.CSSProperties}>
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

      {/* Trend Chart */}
      {period === 'trend' && (
        <div className="trend-chart">
          <div className="period-toggle period-toggle--small">
            <button
              className={`period-toggle__btn ${trendPeriod === 'weekly' ? 'period-toggle__btn--active' : ''}`}
              onClick={() => setTrendPeriod('weekly')}
            >周趋势</button>
            <button
              className={`period-toggle__btn ${trendPeriod === 'monthly' ? 'period-toggle__btn--active' : ''}`}
              onClick={() => setTrendPeriod('monthly')}
            >月趋势</button>
          </div>

          {trendData.length === 0 ? (
            <p className="trend-chart__empty">暂无足够数据</p>
          ) : (
            <>
              <svg
                className="trend-chart__svg"
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Y axis grid lines */}
                {Array.from({ length: 5 }, (_, i) => {
                  const val = (maxTrendHours / 4) * i
                  const y = PAD.top + PLOT_H - (val / maxTrendHours) * PLOT_H
                  return (
                    <g key={i}>
                      <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                      <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#6b7280">
                        {Math.round(val)}时
                      </text>
                    </g>
                  )
                })}

                {/* X axis labels */}
                {trendData.map((d, i) => {
                  const x = PAD.left + (i / Math.max(trendData.length - 1, 1)) * PLOT_W
                  return (
                    <text key={d.label} x={x} y={CHART_H - 6} textAnchor="middle" fontSize={10} fill="#6b7280">
                      {d.label}
                    </text>
                  )
                })}

                {/* Lines for each subject */}
                {trendSubjects.map(subject => {
                  const color = SUBJECT_COLORS[subject]
                  const points = trendData.map((d, i) => {
                    const sub = d.subjects.find(s => s.subject === subject)
                    const sec = sub ? sub.totalSeconds : 0
                    const x = PAD.left + (i / Math.max(trendData.length - 1, 1)) * PLOT_W
                    const y = PAD.top + PLOT_H - (sec / 3600 / maxTrendHours) * PLOT_H
                    return { x, y, sec }
                  })

                  // Check if this subject has any data at all
                  const hasData = points.some(p => p.sec > 0)
                  if (!hasData) return null

              return (
                    <g key={subject}>
                      <polyline
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {points.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={p.sec > 0 ? 4 : 0}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={1.5}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => {
                            const rect = (e.target as SVGCircleElement).closest('svg')?.getBoundingClientRect()
                            if (rect) {
                              setTooltip({
                                x: rect.left + p.x,
                                y: rect.top + p.y,
                                text: `${subject}: ${formatDuration(p.sec)}`
                              })
                            }
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ))}
                    </g>
                  )
                })}
              </svg>

              {/* Legend */}
              <div className="trend-chart__legend">
                {trendSubjects.map(subject => (
                  <div key={subject} className="trend-chart__legend-item">
                    <span className="trend-chart__legend-dot" style={{ background: SUBJECT_COLORS[subject] }} />
                    {subject}
                  </div>
                ))}
              </div>

              {/* Tooltip */}
              {tooltip && (
                <div className="trend-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
                  {tooltip.text}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {period !== 'trend' && stats.length === 0 && (!dayTotals || !dayTotals.some(d => d.totalSeconds > 0)) && (
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
