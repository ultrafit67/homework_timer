import { useState, useEffect, useCallback } from 'react'
import { HomeworkRecord, Subject, TimeStats } from '../types'
import * as db from '../db'
import { computeStats, getTodayDate, getWeekStart, getWeekId } from '../utils'

interface UseRecordsReturn {
  records: HomeworkRecord[]
  loading: boolean
  dailyStats: TimeStats[]
  weeklyStats: TimeStats[]
  dailyTotal: number
  weeklyTotal: number
  weeklyTotals: { weekId: string; totalSeconds: number }[]
  refresh: () => Promise<void>
  deleteRecord: (id: string) => Promise<void>
  updateRecord: (record: HomeworkRecord) => Promise<void>
  filterBySubject: (subject: Subject | null) => void
  subjectFilter: Subject | null
}

export function useRecords(): UseRecordsReturn {
  const [records, setRecords] = useState<HomeworkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState<Subject | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await db.getAllRecords()
      setRecords(all)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleDelete = useCallback(async (id: string) => {
    await db.deleteRecord(id)
    await refresh()
  }, [refresh])

  const handleUpdate = useCallback(async (record: HomeworkRecord) => {
    await db.updateRecord(record)
    await refresh()
  }, [refresh])

  const today = getTodayDate()
  const todayRecords = records.filter(r => r.date === today)

  const weekStart = getWeekStart(today)
  const weekRecords = records.filter(r => r.date >= weekStart && r.date <= today)

  const dailyStats = computeStats(todayRecords)
  const weeklyStats = computeStats(weekRecords)
  const dailyTotal = dailyStats.reduce((s, stat) => s + stat.totalSeconds, 0)
  const weeklyTotal = weeklyStats.reduce((s, stat) => s + stat.totalSeconds, 0)

  // Weekly totals: group records by week, sum durations
  const weekGroups = new Map<string, number>()
  for (const r of records) {
    const wid = getWeekId(r.date)
    weekGroups.set(wid, (weekGroups.get(wid) || 0) + r.durationSeconds)
  }
  const weeklyTotals = Array.from(weekGroups.entries())
    .map(([weekId, totalSeconds]) => ({ weekId, totalSeconds }))
    .sort((a, b) => {
      // Sort by year-week descending
      const [aYear, aWeek] = a.weekId.split('-W').map(Number)
      const [bYear, bWeek] = b.weekId.split('-W').map(Number)
      return bYear - aYear || bWeek - aWeek
    })

  const filteredRecords = subjectFilter
    ? records.filter(r => r.subject === subjectFilter)
    : records

  return {
    records: filteredRecords,
    loading,
    dailyStats,
    weeklyStats,
    dailyTotal,
    weeklyTotal,
    weeklyTotals,
    refresh,
    deleteRecord: handleDelete,
    updateRecord: handleUpdate,
    filterBySubject: setSubjectFilter,
    subjectFilter
  }
}
