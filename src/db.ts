import { openDB, IDBPDatabase } from 'idb'
import { HomeworkRecord, Subject } from './types'

const DB_NAME = 'homework-timer'
const STORE_NAME = 'records'
const DB_VERSION = 2

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
      const newSubject = subjectMap[record.subject] as Subject | undefined
      if (newSubject) {
        record.subject = newSubject
        await cursor.update(record)
        changed = true
      }
      cursor = await cursor.continue()
    }
    await tx.done
    if (changed) {
      console.log('[DB] Migrated old subject names to full names')
    }
  } catch (e) {
    console.warn('[DB] Migration skipped (first visit or empty DB)', e)
  }
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
  return db.getAll(STORE_NAME)
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}

export async function updateRecord(record: HomeworkRecord): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, record)
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
