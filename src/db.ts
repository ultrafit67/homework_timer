import { openDB, IDBPDatabase } from 'idb'
import { HomeworkRecord, Subject, USERS } from './types'
import { loadUserNames, saveUserName, loadGrade, saveGrade } from './utils'

const DB_NAME = 'homework-timer'
const STORE_NAME = 'records'
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase> | null = null
let migrated = false

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, _transaction) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('date', 'date', { unique: false })
          store.createIndex('subject', 'subject', { unique: false })
          store.createIndex('startTime', 'startTime', { unique: false })
        }
        if (oldVersion < 3) {
          const store = _transaction.objectStore(STORE_NAME)
          store.createIndex('user', 'user', { unique: false })
        }
        // v1→v2 subject name migration is done lazily in migrateRecords()
      }
    })
  }
  return dbPromise
}

async function migrateRecords(): Promise<void> {
  if (migrated) return
  migrated = true

  const subjectMap: Record<string, string> = {
    '语': '语文',
    '数': '数学',
    '外': '英语'
  }

  try {
    const db = await getDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    let cursor = await store.openCursor()
    let changed = false
    while (cursor) {
      const record = cursor.value as HomeworkRecord
      // Migrate old subject names (v1→v2)
      const newSubject = subjectMap[record.subject] as Subject | undefined
      if (newSubject) {
        record.subject = newSubject
        changed = true
      }
      // Assign default user if missing (v2→v3)
      if (!record.user) {
        record.user = USERS[0]
        changed = true
      }
      if (changed) {
        await cursor.update(record)
      }
      cursor = await cursor.continue()
    }
    await tx.done
    if (changed) {
      console.log('[DB] Migrated old records')
    }
  } catch (e) {
    console.warn('[DB] Migration skipped (first visit or empty DB)', e)
  }
}

export async function backupAllRecords(): Promise<void> {
  try {
    const all = await getAllRecords()
    const names = loadUserNames()
    const grades = [loadGrade(0), loadGrade(1)]
    const data = { version: 2, records: all, userNames: names, userGrades: grades }
    localStorage.setItem('homework-backup', JSON.stringify(data))
    localStorage.setItem('homework-backup-at', new Date().toISOString())
  } catch (e) {
    console.warn('[DB] Backup failed', e)
  }
}

export async function restoreFromBackup(): Promise<number> {
  const raw = localStorage.getItem('homework-backup')
  if (!raw) throw new Error('没有找到备份数据')
  const data = JSON.parse(raw)
  let records: HomeworkRecord[]
  if (Array.isArray(data)) {
    records = data
  } else if (data.version === 2) {
    records = data.records
    if (data.userNames) {
      for (let i = 0; i < data.userNames.length && i < 2; i++) {
        saveUserName(i, data.userNames[i])
      }
    }
    if (data.userGrades) {
      for (let i = 0; i < data.userGrades.length && i < 2; i++) {
        saveGrade(i, data.userGrades[i])
      }
    }
  } else {
    throw new Error('备份数据格式错误')
  }
  return (await importRecords(records)).imported
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
  await migrateRecords()
  const db = await getDb()
  const all = await db.getAll(STORE_NAME)
  // Filter out soft-deleted records for UI display
  return all.filter(r => !r.deleted)
}

/** Get ALL records including soft-deleted ones (for sync) */
export async function getAllRecordsForSync(): Promise<HomeworkRecord[]> {
  await migrateRecords()
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb()
  const record = await db.get(STORE_NAME, id)
  if (record) {
    record.deleted = true
    await db.put(STORE_NAME, record)
  }
}

/** Actually remove a record from IndexedDB (not soft delete) */
export async function hardDeleteRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}

/** Permanently delete ALL records from IndexedDB */
export async function clearAllRecords(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_NAME)
}

/** Upsert records from sync (update if exists, insert if not) */
export async function upsertRecords(records: HomeworkRecord[]): Promise<void> {
  if (records.length === 0) return
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  for (const record of records) {
    await tx.store.put(record)
  }
  await tx.done
}

export async function updateRecord(record: HomeworkRecord): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, record)
}

export async function importRecords(records: HomeworkRecord[]): Promise<{ imported: number; skipped: number }> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const existingIds = new Set(await store.getAllKeys() as string[])

  let imported = 0
  let skipped = 0
  for (const r of records) {
    if (existingIds.has(r.id)) {
      skipped++
      continue
    }
    await store.put(r)
    existingIds.add(r.id)
    imported++
  }
  await tx.done
  return { imported, skipped }
}

export async function renameUserRecords(oldName: string, newName: string): Promise<number> {
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('user')
  let cursor = await index.openCursor(IDBKeyRange.only(oldName))
  let count = 0
  while (cursor) {
    const record = cursor.value as HomeworkRecord
    record.user = newName
    await cursor.update(record)
    count++
    cursor = await cursor.continue()
  }
  await tx.done
  if (count > 0) {
    console.log(`[DB] Renamed ${count} records: "${oldName}" → "${newName}"`)
  }
  return count
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
