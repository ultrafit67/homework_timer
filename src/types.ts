export const SUBJECTS = ['语文', '数学', '英语', '道法', '历史', '物理', '化学'] as const
export type Subject = typeof SUBJECTS[number]

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type Grade = typeof GRADES[number]

export function getSubjectsForGrade(grade: Grade | 0): Subject[] {
  if (grade === 0) return [...SUBJECTS]
  const subjects: Subject[] = ['语文', '数学']
  if (grade >= 3) subjects.push('英语')
  if (grade >= 6) subjects.push('道法')
  if (grade >= 7) subjects.push('历史')
  if (grade >= 8) subjects.push('物理')
  if (grade >= 9) subjects.push('化学')
  return subjects
}

export interface HomeworkRecord {
  id: string
  subject: Subject
  startTime: string  // ISO 8601
  endTime: string    // ISO 8601
  durationSeconds: number
  date: string       // YYYY-MM-DD
  user: string       // User name, e.g. '刘梦珊' | '刘梦苒'
}

export const USERS = ['老大', '老二'] as const
export type UserId = typeof USERS[number]

export interface TimeStats {
  subject: Subject
  totalSeconds: number
  count: number
}

export type PeriodType = 'daily' | 'weekly'
