import { SUBJECTS, TimeStats, HomeworkRecord, USERS } from './types'

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
  if (h > 0) {
    let r = `${h}时`
    if (m > 0 || s > 0) r += `${m}分`
    if (s > 0) r += `${s}秒`
    return r
  }
  if (m > 0) {
    let r = `${m}分`
    if (s > 0) r += `${s}秒`
    return r
  }
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

const GRADE_STORAGE_PREFIX = 'homework-grade-'
const NAME_STORAGE_PREFIX = 'homework-name-'

const GRADE_DEFAULTS = [0, 0]

export function loadGrade(userIndex: number): number {
  try {
    const stored = localStorage.getItem(`${GRADE_STORAGE_PREFIX}${userIndex}`)
    if (stored !== null) {
      const g = parseInt(stored, 10)
      if (g >= 0 && g <= 9) return g
    }
  } catch { /* localStorage unavailable */ }
  return GRADE_DEFAULTS[userIndex] ?? 0
}

export function saveGrade(userIndex: number, grade: number): void {
  try {
    localStorage.setItem(`${GRADE_STORAGE_PREFIX}${userIndex}`, String(grade))
  } catch { /* localStorage unavailable */ }
}

export function loadUserNames(): string[] {
  try {
    const name0 = localStorage.getItem(`${NAME_STORAGE_PREFIX}0`)
    const name1 = localStorage.getItem(`${NAME_STORAGE_PREFIX}1`)
    return [
      name0 || USERS[0],
      name1 || USERS[1]
    ]
  } catch {
    return [...USERS]
  }
}

export function saveUserName(userIndex: number, name: string): void {
  try {
    localStorage.setItem(`${NAME_STORAGE_PREFIX}${userIndex}`, name)
  } catch { /* localStorage unavailable */ }
}

/* Auto-backup */

export interface AutoBackupConfig {
  enabled: boolean
  time: string  // HH:MM
  keepCount: number
}

export interface BackupEntry {
  id: string
  timestamp: string  // ISO
  date: string       // YYYY-MM-DD
}

const BACKUP_CONFIG_KEY = 'homework-auto-backup-config'
const BACKUP_INDEX_KEY = 'homework-backup-index'

export function getAutoBackupConfig(): AutoBackupConfig {
  try {
    const raw = localStorage.getItem(BACKUP_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { enabled: false, time: '20:00', keepCount: 10 }
}

export function saveAutoBackupConfig(config: AutoBackupConfig): void {
  localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config))
}

export function getBackupList(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addBackup(id: string, timestamp: string, data: string): void {
  const list = getBackupList()
  list.push({ id, timestamp, date: timestamp.slice(0, 10) })
  localStorage.setItem(`homework-backup-${id}`, data)
  localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(list))
}

export function deleteBackup(id: string): void {
  localStorage.removeItem(`homework-backup-${id}`)
  const list = getBackupList().filter(e => e.id !== id)
  localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(list))
}

export function cleanOldBackups(keepCount: number): void {
  const list = getBackupList()
  list.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  while (list.length > keepCount) {
    const old = list.shift()!
    localStorage.removeItem(`homework-backup-${old.id}`)
  }
  localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(list))
}

export function loadBackupData(id: string): string | null {
  try {
    return localStorage.getItem(`homework-backup-${id}`)
  } catch { return null }
}

export function hasBackupToday(list: BackupEntry[]): boolean {
  const today = getTodayDate()
  return list.some(e => e.date === today)
}

/* File System backup directory */

const HANDLE_DB = 'homework-file-handles'
const HANDLE_STORE = 'handles'
const HANDLE_KEY = 'backup-dir'

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function persistDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB()
  const tx = db.transaction(HANDLE_STORE, 'readwrite')
  tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB()
    const tx = db.transaction(HANDLE_STORE, 'readonly')
    const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY)
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}

export function saveBackupDirName(name: string): void {
  localStorage.setItem('homework-backup-dir-name', name)
}

export function getBackupDirName(): string {
  return localStorage.getItem('homework-backup-dir-name') || ''
}

export function backupFileName(timestamp: string): string {
  const d = timestamp.slice(0, 10)
  const t = timestamp.slice(11, 19).replace(/:/g, '')
  return `homework-auto-backup-${d}_${t}.json`
}

export async function writeBackupToDir(
  handle: FileSystemDirectoryHandle,
  _id: string,
  timestamp: string,
  data: string
): Promise<void> {
  const name = backupFileName(timestamp)
  const fileHandle = await handle.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function cleanOldBackupFiles(
  handle: FileSystemDirectoryHandle,
  keepCount: number
): Promise<void> {
  const files: { name: string; ts: string }[] = []
  const dir: any = handle
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file') continue
    const m = entry.name.match(/^homework-auto-backup-(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})\.json$/)
    if (m) files.push({ name: entry.name, ts: `${m[1]}T${m[2]}:${m[3]}:${m[4]}` })
  }
  files.sort((a, b) => a.ts.localeCompare(b.ts))
  while (files.length > keepCount) {
    const old = files.shift()!
    await handle.removeEntry(old.name)
  }
}

export function supportsFileSystemAPI(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
