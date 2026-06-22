export const SUBJECTS = ['语文', '数学', '英语', '道法', '历史', '物理', '化学'] as const
export type Subject = typeof SUBJECTS[number]

export interface HomeworkRecord {
  id: string
  subject: Subject
  startTime: string  // ISO 8601
  endTime: string    // ISO 8601
  durationSeconds: number
  date: string       // YYYY-MM-DD
}

export interface TimeStats {
  subject: Subject
  totalSeconds: number
  count: number
}

export type PeriodType = 'daily' | 'weekly'
