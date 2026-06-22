import { SUBJECTS, TimeStats, HomeworkRecord } from './types'

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

export function getTodayDate(): string {
  const d = new Date()
  return formatDate(d)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

export function getWeekId(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  const week = Math.ceil((days + jan1.getDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return formatDate(d)
}

export function computeStats(records: HomeworkRecord[]): TimeStats[] {
  return SUBJECTS.map(subject => {
    const filtered = records.filter(r => r.subject === subject)
    const totalSeconds = filtered.reduce((sum, r) => sum + r.durationSeconds, 0)
    return { subject, totalSeconds, count: filtered.length }
  })
    .filter(s => s.count > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
}
