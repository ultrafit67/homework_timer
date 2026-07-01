import { useState, useEffect } from 'react'
import { getAllRecords } from '../db'
import { BADGES, BadgeDef, BadgeEntry, computeBadges } from '../badges'

interface BadgeWallProps {
  users: string[]
  onClose: () => void
}

function BadgeCard({ def, entry }: { def: BadgeDef; entry: BadgeEntry }) {
  const [showDetail, setShowDetail] = useState(false)
  const unlocked = entry.unlocked

  const handleClick = () => {
    if (unlocked) {
      setShowDetail(!showDetail)
    } else {
      setShowDetail(!showDetail)
    }
  }

  return (
    <div className={`badge-card${unlocked ? '' : ' badge-card--locked'}`} onClick={handleClick}>
      <span className="badge-card__icon">{def.icon}</span>
      {unlocked ? (
        <div className="badge-card__name">{def.name}</div>
      ) : (
        <div className="badge-card__locked-label">???</div>
      )}
      {showDetail && (
        <div className="badge-card__detail">
          {unlocked && entry.unlockedAt ? (
            <>
              达成时间：{new Date(entry.unlockedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </>
          ) : (
            <>{def.description}（{def.conditionDesc}）</>
          )}
        </div>
      )}
    </div>
  )
}

export function BadgeWall({ users, onClose }: BadgeWallProps) {
  const [userBadges, setUserBadges] = useState<Record<string, BadgeEntry[]>>({})
  const [selectedUser, setSelectedUser] = useState(users[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const records = await getAllRecords()
      if (cancelled) return
      const result: Record<string, BadgeEntry[]> = {}
      for (const user of users) {
        result[user] = computeBadges(user, records)
      }
      setUserBadges(result)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [users])

  const current = userBadges[selectedUser] || []
  const unlockedCount = current.filter(b => b.unlocked).length
  const streakBadges = current.filter(b => b.id.startsWith('streak_'))
  const timeBadges = current.filter(b => b.id.startsWith('time_'))

  const badgeDefMap = new Map(BADGES.map(b => [b.id, b]))

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog--badge-wall" onClick={e => e.stopPropagation()}>
        <h3 className="dialog__title">徽章墙</h3>

        {users.length > 1 && (
          <div className="user-tabs">
            {users.map(u => (
              <button
                key={u}
                className={`user-tabs__tab ${selectedUser === u ? 'user-tabs__tab--active' : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                {u}
              </button>
            ))}
          </div>
        )}

        <div className="badge-summary">
          已获得 {unlockedCount}/{current.length} 枚徽章
        </div>

        {loading ? (
          <div className="badge-grid__loading">加载中...</div>
        ) : current.length === 0 ? (
          <p className="badge-grid__empty">暂无记录</p>
        ) : (
          <>
            <h4 className="badge-section-title">🔥 连续打卡</h4>
            <div className="badge-grid">
              {streakBadges.map(e => {
                const def = badgeDefMap.get(e.id)
                return def ? <BadgeCard key={e.id} def={def} entry={e} /> : null
              })}
            </div>

            <h4 className="badge-section-title">⏱️ 时长成就</h4>
            <div className="badge-grid">
              {timeBadges.map(e => {
                const def = badgeDefMap.get(e.id)
                return def ? <BadgeCard key={e.id} def={def} entry={e} /> : null
              })}
            </div>
          </>
        )}

        <div className="dialog__actions">
          <button className="btn btn--primary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
