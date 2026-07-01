import { HomeworkRecord } from './types'

const STORAGE_PREFIX = 'homework-badges-'
const CACHE_PREFIX = 'homework-badges-cache-'

export interface BadgeDef {
  id: string
  category: 'streak' | 'time'
  name: string
  description: string // vague clue for locked state
  icon: string
  conditionDesc: string
}

export interface BadgeEntry {
  id: string
  unlocked: boolean
  unlockedAt?: string // ISO date of first unlock
  progress: number
  target: number
}

export const BADGES: BadgeDef[] = [
  // Streak
  { id: 'streak_3', category: 'streak', name: '小试牛刀', description: '连续打卡一定天数', icon: '🌱', conditionDesc: '连续打卡3天' },
  { id: 'streak_7', category: 'streak', name: '一周不断', description: '坚持一整周不中断', icon: '🔥', conditionDesc: '连续打卡7天' },
  { id: 'streak_30', category: 'streak', name: '月度坚持者', description: '整整一个月，天天打卡', icon: '💪', conditionDesc: '连续打卡30天' },
  { id: 'streak_100', category: 'streak', name: '百日筑基', description: '三个多月的坚持', icon: '🏆', conditionDesc: '连续打卡100天' },
  // Time
  { id: 'time_10h', category: 'time', name: '初出茅庐', description: '累计学习一定小时数', icon: '⏱️', conditionDesc: '累计学习10小时' },
  { id: 'time_50h', category: 'time', name: '小有成就', description: '累计学习几十小时', icon: '🥉', conditionDesc: '累计学习50小时' },
  { id: 'time_100h', category: 'time', name: '百时达人', description: '累计学习三位数小时', icon: '🥈', conditionDesc: '累计学习100小时' },
  { id: 'time_200h', category: 'time', name: '勤奋之星', description: '累计学习两三百小时', icon: '🥇', conditionDesc: '累计学习200小时' },
  { id: 'time_1000h', category: 'time', name: '千时学霸', description: '累计学习四位数小时', icon: '👑', conditionDesc: '累计学习1000小时' },
]

const computeCache = new Map<string, BadgeEntry[]>()

function cacheKey(userName: string, records: HomeworkRecord[]): string {
  const totalSeconds = records.reduce((s, r) => s + r.durationSeconds, 0)
  return `${userName}:${records.length}:${totalSeconds}`
}

function loadCachedEntries(userName: string, key: string): BadgeEntry[] | null {
  const mem = computeCache.get(key)
  if (mem) return mem
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userName)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (cached._key === key) return cached.entries as BadgeEntry[]
  } catch {}
  return null
}

function saveCachedEntries(userName: string, key: string, entries: BadgeEntry[]): void {
  computeCache.set(key, entries)
  try {
    localStorage.setItem(CACHE_PREFIX + userName, JSON.stringify({ _key: key, entries }))
  } catch {}
}

function getThreshold(id: string): number {
  const m = id.match(/_(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

function loadSaved(userName: string): Record<string, { unlockedAt?: string }> {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + userName) || '{}') } catch { return {} }
}

function saveSaved(userName: string, data: Record<string, { unlockedAt?: string }>): void {
  try { localStorage.setItem(STORAGE_PREFIX + userName, JSON.stringify(data)) } catch {}
}

/** Compute badge entries for a single user from their homework records. */
export function computeBadges(userName: string, records: HomeworkRecord[]): BadgeEntry[] {
  const userRecords = records.filter(r => r.user === userName)
  const ck = cacheKey(userName, userRecords)

  const cached = loadCachedEntries(userName, ck)
  if (cached) return cached

  const saved = loadSaved(userName)

  const dates = [...new Set(userRecords.map(r => r.date))].sort()

  let maxStreak = 0
  const firstStreakAt: Record<number, string> = {}
  if (dates.length > 0) {
    let cur = 1
    maxStreak = 1
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000)
      if (diff === 1) {
        cur++
        maxStreak = Math.max(maxStreak, cur)
        for (const t of [3, 7, 30, 100]) {
          if (cur >= t && !(t in firstStreakAt)) firstStreakAt[t] = dates[i]
        }
      } else if (diff > 1) {
        cur = 1
      }
    }
  }

  const sortedByDate = [...userRecords].sort((a, b) => a.date.localeCompare(b.date))
  let cumulativeSeconds = 0
  const firstTimeAt: Record<number, string> = {}
  const timeTargets = [10, 50, 100, 200, 1000]
  for (const r of sortedByDate) {
    cumulativeSeconds += r.durationSeconds
    const hours = cumulativeSeconds / 3600
    for (const t of timeTargets) {
      if (hours >= t && !(t in firstTimeAt)) firstTimeAt[t] = r.date
    }
  }
  const totalHours = Math.round(cumulativeSeconds / 3600 * 10) / 10

  const newSaved = { ...saved }

  const entries = BADGES.map(badge => {
    const target = getThreshold(badge.id)
    const progress = badge.category === 'streak' ? maxStreak : totalHours
    const qualifies = progress >= target

    const existed = saved[badge.id]?.unlockedAt
    let unlockedAt

    if (qualifies) {
      const estimatedDate = badge.category === 'streak' ? firstStreakAt[target] : firstTimeAt[target]
      unlockedAt = estimatedDate ? new Date(estimatedDate + 'T00:00:00').toISOString() : new Date().toISOString()
      if (!existed || existed !== unlockedAt) {
        newSaved[badge.id] = { unlockedAt }
      }
    } else if (existed) {
      unlockedAt = existed
    }

    return { id: badge.id, unlocked: qualifies || !!existed, unlockedAt, progress, target }
  })

  saveSaved(userName, newSaved)
  saveCachedEntries(userName, ck, entries)
  return entries
}
