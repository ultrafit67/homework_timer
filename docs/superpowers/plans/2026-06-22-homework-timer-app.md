# 作业计时 App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA homework timer with subject selection, timing, and daily/weekly statistics.

**Architecture:** Single-page React app with 3 tab views (Timer, Stats, Records). IndexedDB for persistence via the `idb` wrapper. No backend — all data stored locally.

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, idb (IndexedDB wrapper), vite-plugin-pwa

**File Structure:**
```
homework_app/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── vite-env.d.ts
│   ├── types.ts
│   ├── db.ts
│   ├── utils.ts
│   ├── hooks/
│   │   ├── useTimer.ts
│   │   └── useRecords.ts
│   ├── components/
│   │   ├── BottomNav.tsx
│   │   ├── SubjectButton.tsx
│   │   ├── TimerDisplay.tsx
│   │   ├── TotalTimeCard.tsx
│   │   ├── RankingItem.tsx
│   │   ├── RecordItem.tsx
│   │   └── ConfirmDialog.tsx
│   └── pages/
│       ├── TimerView.tsx
│       ├── StatsView.tsx
│       └── RecordsView.tsx
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `homework_app/package.json`
- Create: `homework_app/tsconfig.json`
- Create: `homework_app/tsconfig.app.json`
- Create: `homework_app/tsconfig.node.json`
- Create: `homework_app/vite.config.ts`
- Create: `homework_app/index.html`
- Create: `homework_app/src/vite-env.d.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "homework-timer",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "idb": "^8.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 3: Create `tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '作业计时器',
        short_name: '作业计时',
        description: '记录和统计每日作业时间的工具',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
})
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#4F46E5" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <title>作业计时器</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 8: Install dependencies**

Run: `npm install` in `homework_app/`

---

### Task 2: Types and Utilities

**Files:**
- Create: `homework_app/src/types.ts`
- Create: `homework_app/src/utils.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export const SUBJECTS = ['语', '数', '外', '道法', '历史', '物理', '化学'] as const
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
```

- [ ] **Step 2: Create `src/utils.ts`**

```typescript
import { Subject, SUBJECTS, TimeStats, HomeworkRecord } from './types'

export function generateId(): string {
  return crypto.randomUUID()
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
  if (h > 0) return `${h}时${m}分`
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
```

---

### Task 3: IndexedDB Data Layer

**Files:**
- Create: `homework_app/src/db.ts`

- [ ] **Step 1: Create `src/db.ts`**

```typescript
import { openDB, IDBPDatabase } from 'idb'
import { HomeworkRecord } from './types'

const DB_NAME = 'homework-timer'
const STORE_NAME = 'records'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('date', 'date', { unique: false })
          store.createIndex('subject', 'subject', { unique: false })
          store.createIndex('startTime', 'startTime', { unique: false })
        }
      }
    })
  }
  return dbPromise
}

export async function addRecord(record: HomeworkRecord): Promise<void> {
  const db = await getDb()
  await db.add(STORE_NAME, record)
}

export async function getRecordsByDate(date: string): Promise<HomeworkRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex(STORE_NAME, 'date', date)
}

export async function getRecordsInRange(startDate: string, endDate: string): Promise<HomeworkRecord[]> {
  const db = await getDb()
  const range = IDBKeyRange.bound(startDate, endDate)
  const records: HomeworkRecord[] = []
  let cursor = await db.transaction(STORE_NAME).store.index('date').openCursor(range)
  while (cursor) {
    records.push(cursor.value)
    cursor = await cursor.continue()
  }
  return records
}

export async function getAllRecords(): Promise<HomeworkRecord[]> {
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}

export async function getDateGroups(): Promise<string[]> {
  const db = await getDb()
  const dates = new Set<string>()
  let cursor = await db.transaction(STORE_NAME).store.index('date').openCursor(null, 'prev')
  while (cursor) {
    dates.add(cursor.value.date)
    cursor = await cursor.continue()
  }
  return Array.from(dates)
}
```

---

### Task 4: Custom Hooks

**Files:**
- Create: `homework_app/src/hooks/useTimer.ts`
- Create: `homework_app/src/hooks/useRecords.ts`

- [ ] **Step 1: Create `src/hooks/useTimer.ts`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { Subject } from '../types'
import { generateId, getTodayDate } from '../utils'

export type TimerStatus = 'idle' | 'subjectSelected' | 'timing' | 'completed'

interface TimerState {
  status: TimerStatus
  selectedSubject: Subject | null
  elapsedSeconds: number
  startTime: string | null
}

interface UseTimerReturn {
  status: TimerStatus
  selectedSubject: Subject | null
  elapsedSeconds: number
  formattedTime: string
  selectSubject: (subject: Subject) => void
  start: () => void
  complete: () => { id: string; subject: Subject; startTime: string; endTime: string; durationSeconds: number; date: string } | null
  reset: () => void
}

export function useTimer(): UseTimerReturn {
  const [state, setState] = useState<TimerState>({
    status: 'idle',
    selectedSubject: null,
    elapsedSeconds: 0,
    startTime: null
  })
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (state.status === 'timing') {
      intervalRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }))
      }, 1000)
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.status])

  const selectSubject = useCallback((subject: Subject) => {
    setState(prev => {
      if (prev.status === 'idle') {
        return { ...prev, status: 'subjectSelected', selectedSubject: subject }
      }
      return prev
    })
  }, [])

  const start = useCallback(() => {
    setState(prev => {
      if (prev.status === 'subjectSelected' && prev.selectedSubject) {
        const now = new Date().toISOString()
        return { ...prev, status: 'timing', elapsedSeconds: 0, startTime: now }
      }
      return prev
    })
  }, [])

  const complete = useCallback(() => {
    let result: ReturnType<UseTimerReturn['complete']> = null
    setState(prev => {
      if (prev.status === 'timing' && prev.selectedSubject && prev.startTime) {
        const now = new Date().toISOString()
        result = {
          id: generateId(),
          subject: prev.selectedSubject,
          startTime: prev.startTime,
          endTime: now,
          durationSeconds: prev.elapsedSeconds,
          date: getTodayDate()
        }
        return { status: 'completed', selectedSubject: null, elapsedSeconds: 0, startTime: null }
      }
      return prev
    })
    return result
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', selectedSubject: null, elapsedSeconds: 0, startTime: null })
  }, [])

  const hours = Math.floor(state.elapsedSeconds / 3600)
  const minutes = Math.floor((state.elapsedSeconds % 3600) / 60)
  const seconds = state.elapsedSeconds % 60
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return {
    status: state.status,
    selectedSubject: state.selectedSubject,
    elapsedSeconds: state.elapsedSeconds,
    formattedTime,
    selectSubject,
    start,
    complete,
    reset
  }
}
```

- [ ] **Step 2: Create `src/hooks/useRecords.ts`**

```typescript
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
    filterBySubject: setSubjectFilter,
    subjectFilter
  }
}
```

---

### Task 5: Timer Page + Components

**Files:**
- Create: `homework_app/src/components/SubjectButton.tsx`
- Create: `homework_app/src/components/TimerDisplay.tsx`
- Create: `homework_app/src/components/ConfirmDialog.tsx`
- Create: `homework_app/src/pages/TimerView.tsx`

- [ ] **Step 1: Create `src/components/SubjectButton.tsx`**

```tsx
import { Subject } from '../types'

interface SubjectButtonProps {
  subject: Subject
  selected: boolean
  disabled: boolean
  onClick: (subject: Subject) => void
}

const SUBJECT_COLORS: Record<Subject, string> = {
  '语': '#EF4444',
  '数': '#3B82F6',
  '外': '#10B981',
  '道法': '#F59E0B',
  '历史': '#8B5CF6',
  '物理': '#EC4899',
  '化学': '#06B6D4'
}

export function SubjectButton({ subject, selected, disabled, onClick }: SubjectButtonProps) {
  return (
    <button
      className={`subject-btn ${selected ? 'subject-btn--selected' : ''}`}
      style={{
        '--subject-color': SUBJECT_COLORS[subject],
        opacity: disabled && !selected ? 0.5 : 1
      } as React.CSSProperties}
      onClick={() => onClick(subject)}
      disabled={disabled && !selected}
    >
      {subject}
    </button>
  )
}
```

- [ ] **Step 2: Create `src/components/TimerDisplay.tsx`**

```tsx
interface TimerDisplayProps {
  time: string
  isRunning: boolean
}

export function TimerDisplay({ time, isRunning }: TimerDisplayProps) {
  return (
    <div className={`timer-display ${isRunning ? 'timer-display--running' : ''}`}>
      <div className="timer-display__time">{time}</div>
      <div className="timer-display__label">
        {isRunning ? '计时中...' : '准备就绪'}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/ConfirmDialog.tsx`**

```tsx
interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog__title">{title}</div>
        <div className="dialog__message">{message}</div>
        <div className="dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel}>取消</button>
          <button className="btn btn--primary" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/pages/TimerView.tsx`**

```tsx
import { useState } from 'react'
import { SUBJECTS, Subject } from '../types'
import { useTimer } from '../hooks/useTimer'
import { SubjectButton } from '../components/SubjectButton'
import { TimerDisplay } from '../components/TimerDisplay'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { addRecord } from '../db'

interface TimerViewProps {
  onRecordAdded: () => void
}

export function TimerView({ onRecordAdded }: TimerViewProps) {
  const timer = useTimer()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubjectClick = (subject: Subject) => {
    timer.selectSubject(subject)
  }

  const handleStart = () => {
    timer.start()
  }

  const handleComplete = () => {
    setShowConfirm(true)
  }

  const handleConfirmComplete = async () => {
    setShowConfirm(false)
    const record = timer.complete()
    if (record) {
      await addRecord(record)
      onRecordAdded()
    }
  }

  const canStart = timer.status === 'subjectSelected'
  const isRunning = timer.status === 'timing'
  const canComplete = isRunning

  // Get time info for the dialog
  const getConfirmMessage = () => {
    if (!timer.selectedSubject) return ''
    return `${timer.selectedSubject} 用时 ${timer.formattedTime}`
  }

  return (
    <div className="page timer-page">
      <h2 className="page__title">选择科目</h2>

      <div className="subject-grid">
        {SUBJECTS.map(s => (
          <SubjectButton
            key={s}
            subject={s}
            selected={timer.selectedSubject === s}
            disabled={isRunning}
            onClick={handleSubjectClick}
          />
        ))}
      </div>

      <TimerDisplay time={timer.formattedTime} isRunning={isRunning} />

      <div className="action-buttons">
        {!isRunning ? (
          <button
            className={`btn btn--primary btn--large ${!canStart ? 'btn--disabled' : ''}`}
            onClick={handleStart}
            disabled={!canStart}
          >
            开始
          </button>
        ) : (
          <button
            className={`btn btn--danger btn--large ${!canComplete ? 'btn--disabled' : ''}`}
            onClick={handleComplete}
            disabled={!canComplete}
          >
            完成
          </button>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="确认完成"
        message={getConfirmMessage()}
        onConfirm={handleConfirmComplete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
```

---

### Task 6: Stats Page

**Files:**
- Create: `homework_app/src/components/TotalTimeCard.tsx`
- Create: `homework_app/src/components/RankingItem.tsx`
- Create: `homework_app/src/pages/StatsView.tsx`

- [ ] **Step 1: Create `src/components/TotalTimeCard.tsx`**

```tsx
interface TotalTimeCardProps {
  label: string
  totalSeconds: number
}

export function TotalTimeCard({ label, totalSeconds }: TotalTimeCardProps) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const display = h > 0 ? `${h}时${m}分` : `${m}分`

  return (
    <div className="total-card">
      <div className="total-card__label">{label}</div>
      <div className="total-card__time">{display}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/RankingItem.tsx`**

```tsx
import { Subject } from '../types'

interface RankingItemProps {
  subject: Subject
  totalSeconds: number
  count: number
  rank: number
}

const SUBJECT_COLORS: Record<Subject, string> = {
  '语': '#EF4444',
  '数': '#3B82F6',
  '外': '#10B981',
  '道法': '#F59E0B',
  '历史': '#8B5CF6',
  '物理': '#EC4899',
  '化学': '#06B6D4'
}

export function RankingItem({ subject, totalSeconds, count, rank }: RankingItemProps) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const display = h > 0 ? `${h}小时${m}分钟` : `${m}分钟`
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
```

- [ ] **Step 3: Create `src/pages/StatsView.tsx`**

```tsx
import { useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { TotalTimeCard } from '../components/TotalTimeCard'
import { RankingItem } from '../components/RankingItem'
import { SUBJECTS } from '../types'
import { PeriodType } from '../types'

export function StatsView() {
  const { dailyStats, weeklyStats, dailyTotal, weeklyTotal, weeklyTotals, loading } = useRecords()
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
              return (
                <div key={item.weekId} className="weekly-item">
                  <div className="weekly-item__rank">#{i + 1}</div>
                  <div className="weekly-item__week">第{item.weekId.split('-W')[1]}周</div>
                  <div className="weekly-item__time">
                    {h > 0 ? `${h}时${m}分` : `${m}分`}
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
```

---

### Task 7: Records Page

**Files:**
- Create: `homework_app/src/components/RecordItem.tsx`
- Create: `homework_app/src/pages/RecordsView.tsx`

- [ ] **Step 1: Create `src/components/RecordItem.tsx`**

```tsx
import { HomeworkRecord } from '../types'
import { formatTime, formatDuration } from '../utils'

interface RecordItemProps {
  record: HomeworkRecord
  onDelete: (id: string) => void
}

const SUBJECT_COLORS: Record<string, string> = {
  '语': '#EF4444',
  '数': '#3B82F6',
  '外': '#10B981',
  '道法': '#F59E0B',
  '历史': '#8B5CF6',
  '物理': '#EC4899',
  '化学': '#06B6D4'
}

export function RecordItem({ record, onDelete }: RecordItemProps) {
  return (
    <div className="record-item">
      <div className="record-item__subject" style={{ backgroundColor: SUBJECT_COLORS[record.subject] }}>
        {record.subject}
      </div>
      <div className="record-item__body">
        <div className="record-item__date">{record.date}</div>
        <div className="record-item__time-range">
          {formatTime(record.startTime)} - {formatTime(record.endTime)}
        </div>
        <div className="record-item__duration">{formatDuration(record.durationSeconds)}</div>
      </div>
      <button
        className="record-item__delete"
        onClick={() => {
          if (confirm('确认删除此记录？')) {
            onDelete(record.id)
          }
        }}
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/RecordsView.tsx`**

```tsx
import { useState } from 'react'
import { useRecords } from '../hooks/useRecords'
import { RecordItem } from '../components/RecordItem'
import { SUBJECTS, Subject } from '../types'

const PAGE_SIZE = 20

export function RecordsView() {
  const { records, loading, deleteRecord, filterBySubject, subjectFilter } = useRecords()
  const [page, setPage] = useState(0)

  if (loading) {
    return <div className="page"><p className="loading-text">加载中...</p></div>
  }

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )

  const totalPages = Math.ceil(sortedRecords.length / PAGE_SIZE)
  const pageRecords = sortedRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleFilter = (subject: Subject | null) => {
    filterBySubject(subject)
    setPage(0)
  }

  return (
    <div className="page records-page">
      <h2 className="page__title">记录</h2>

      <div className="filter-bar">
        <button
          className={`filter-bar__btn ${subjectFilter === null ? 'filter-bar__btn--active' : ''}`}
          onClick={() => handleFilter(null)}
        >
          全部
        </button>
        {SUBJECTS.map(s => (
          <button
            key={s}
            className={`filter-bar__btn ${subjectFilter === s ? 'filter-bar__btn--active' : ''}`}
            onClick={() => handleFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {pageRecords.length === 0 ? (
        <p className="empty-text">暂无记录</p>
      ) : (
        <>
          <div className="record-list">
            {pageRecords.map(r => (
              <RecordItem key={r.id} record={r} onDelete={deleteRecord} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn--small"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </button>
              <span className="pagination__info">{page + 1} / {totalPages}</span>
              <button
                className="btn btn--small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

---

### Task 8: Navigation, App Shell, and Styles

**Files:**
- Create: `homework_app/src/components/BottomNav.tsx`
- Create: `homework_app/src/App.tsx`
- Create: `homework_app/src/main.tsx`
- Create: `homework_app/src/styles.css`

- [ ] **Step 1: Create `src/components/BottomNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">⏱</span>
        <span className="bottom-nav__label">计时</span>
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">📊</span>
        <span className="bottom-nav__label">统计</span>
      </NavLink>
      <NavLink to="/records" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">📋</span>
        <span className="bottom-nav__label">记录</span>
      </NavLink>
    </nav>
  )
}
```

- [ ] **Step 2: Create `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { TimerView } from './pages/TimerView'
import { StatsView } from './pages/StatsView'
import { RecordsView } from './pages/RecordsView'
import { useRecords } from './hooks/useRecords'

function AppContent() {
  const { refresh } = useRecords()

  return (
    <div className="app">
      <div className="app__content">
        <Routes>
          <Route path="/" element={<TimerView onRecordAdded={refresh} />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/records" element={<RecordsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Create `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Create `src/styles.css`**

```css
:root {
  --color-primary: #4F46E5;
  --color-primary-light: #818CF8;
  --color-danger: #EF4444;
  --color-bg: #F3F4F6;
  --color-surface: #FFFFFF;
  --color-text: #1F2937;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --nav-height: 60px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

#root {
  height: 100%;
}

/* App Layout */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  background: var(--color-surface);
  position: relative;
}

.app__content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--nav-height);
  -webkit-overflow-scrolling: touch;
}

/* Page */
.page {
  padding: 20px 16px;
}

.page__title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text);
}

.page__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.page__header .page__title {
  margin-bottom: 0;
}

/* Subject Grid */
.subject-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

/* Subject Button */
.subject-btn {
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 16px;
  font-size: 22px;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-bg);
  color: var(--color-text);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.subject-btn:active {
  transform: scale(0.95);
}

.subject-btn--selected {
  border-color: var(--subject-color, var(--color-primary));
  background: color-mix(in srgb, var(--subject-color, var(--color-primary)) 15%, white);
  box-shadow: 0 0 0 1px var(--subject-color, var(--color-primary));
}

/* Timer Display */
.timer-display {
  text-align: center;
  padding: 24px 0;
  margin-bottom: 24px;
}

.timer-display__time {
  font-size: 56px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 4px;
  color: var(--color-text);
  transition: color 0.3s;
}

.timer-display--running .timer-display__time {
  color: var(--color-primary);
}

.timer-display__label {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

/* Action Buttons */
.action-buttons {
  text-align: center;
  padding: 0 32px;
}

/* Buttons */
.btn {
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.btn:active {
  transform: scale(0.97);
}

.btn--large {
  width: 100%;
  padding: 16px 32px;
  font-size: 18px;
  border-radius: 14px;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
}

.btn--primary:hover {
  background: var(--color-primary-light);
}

.btn--danger {
  background: var(--color-danger);
  color: white;
}

.btn--secondary {
  background: var(--color-bg);
  color: var(--color-text);
}

.btn--text {
  background: none;
  color: var(--color-primary);
  padding: 8px 16px;
}

.btn--small {
  padding: 8px 16px;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}

.btn--disabled, .btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

.btn--center {
  display: block;
  margin: 16px auto 0;
}

/* Bottom Nav */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  height: var(--nav-height);
  display: flex;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--color-text-secondary);
  gap: 2px;
  transition: color 0.2s;
}

.bottom-nav__item--active {
  color: var(--color-primary);
}

.bottom-nav__icon {
  font-size: 22px;
  line-height: 1;
}

.bottom-nav__label {
  font-size: 11px;
  font-weight: 500;
}

/* Period Toggle */
.period-toggle {
  display: flex;
  background: var(--color-bg);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 16px;
}

.period-toggle__btn {
  flex: 1;
  border: none;
  background: none;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.period-toggle__btn--active {
  background: var(--color-surface);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Total Time Card */
.total-card {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: white;
  margin-bottom: 20px;
}

.total-card__label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.total-card__time {
  font-size: 36px;
  font-weight: 700;
}

/* Ranking List */
.ranking-list {
  margin-top: 8px;
}

.ranking-list__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text);
}

/* Ranking Item */
.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}

.ranking-item:last-child {
  border-bottom: none;
}

.ranking-item__rank {
  width: 28px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-secondary);
  text-align: center;
}

.ranking-item__subject {
  font-size: 20px;
  font-weight: 700;
  width: 36px;
  text-align: center;
}

.ranking-item__info {
  flex: 1;
}

.ranking-item__time {
  font-size: 15px;
  font-weight: 600;
}

.ranking-item__count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.ranking-item__bar {
  width: 80px;
  height: 6px;
  background: var(--color-bg);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.ranking-item__bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* Record Item */
.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}

.record-item:last-child {
  border-bottom: none;
}

.record-item__subject {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.record-item__body {
  flex: 1;
  min-width: 0;
}

.record-item__date {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.record-item__time-range {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.record-item__duration {
  font-size: 14px;
  font-weight: 600;
  margin-top: 2px;
}

.record-item__delete {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 8px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.record-item__delete:hover {
  opacity: 1;
  color: var(--color-danger);
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.filter-bar::-webkit-scrollbar {
  display: none;
}

.filter-bar__btn {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.filter-bar__btn--active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0;
}

.pagination__info {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Weekly List */
.weekly-list {
  margin-top: 8px;
}

.weekly-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}

.weekly-item:last-child {
  border-bottom: none;
}

.weekly-item__rank {
  width: 32px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary);
  text-align: center;
}

.weekly-item__week {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

.weekly-item__time {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.dialog {
  background: var(--color-surface);
  border-radius: 20px;
  padding: 28px 24px 20px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.dialog__title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
  text-align: center;
}

.dialog__message {
  font-size: 15px;
  color: var(--color-text-secondary);
  text-align: center;
  margin-bottom: 24px;
  line-height: 1.5;
}

.dialog__actions {
  display: flex;
  gap: 12px;
}

.dialog__actions .btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
}

/* Misc */
.empty-text {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 40px 0;
  font-size: 15px;
}

.loading-text {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 60px 0;
  font-size: 15px;
}
```

---

### Task 9: PWA Icon and Build Verification

**Files:**
- Create: `homework_app/public/favicon.svg`

- [ ] **Step 1: Create `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#4F46E5"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="white" stroke-width="32"/>
  <path d="M256 160 V256 L320 288" fill="none" stroke="white" stroke-width="24" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Build the project**

Run: `npm run build`

Expected: `dist/` directory created with `index.html`, JS/CSS bundles, and PWA manifest/service worker files.

- [ ] **Step 3: Verify build output**

Run: `ls -la dist/` and check for expected files: `index.html`, `assets/index-*.js`, `assets/index-*.css`, `manifest.webmanifest`, `sw.js`

- [ ] **Step 4: Start dev server to verify**

Run: `npm run dev` (check that it starts without errors, then stop with Ctrl+C)

---

## Implementation Order

The tasks above are designed to be implemented **sequentially** since each builds on the previous:

1. **Task 1** → Scaffolding (must be first)
2. **Task 2** → Types and utils (no deps on other code)
3. **Task 3** → DB layer (depends on types)
4. **Task 4** → Hooks (depends on types, utils)
5. **Task 5** → Timer view (depends on hooks, DB)
6. **Task 6** → Stats view (depends on hooks)
7. **Task 7** → Records view (depends on hooks, DB)
8. **Task 8** → App shell + styles (depends on all pages)
9. **Task 9** → PWA + build verification

Each task can be delegated to a separate subagent with the full context of previous tasks.
