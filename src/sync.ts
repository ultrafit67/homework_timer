import { HomeworkRecord } from './types'
import { initCloudBase, getDB, stopCloudBase, isReady } from './cloudbase'
import { getAllRecords as getAllLocalRecords, upsertRecords } from './db'

const POLL_INTERVAL = 30000
const LS_ENABLED = 'sync-enabled'
const LS_ENV_ID = 'sync-env-id'
const LS_LAST_SYNC = 'sync-last-sync'
const LS_PENDING = 'sync-pending'

let pollTimer: ReturnType<typeof setInterval> | null = null
let _onStatusChange: ((status: string) => void) | null = null
let _currentStatus = 'closed'

// ---- Settings helpers ----

export function isSyncEnabled(): boolean {
  return localStorage.getItem(LS_ENABLED) === 'true'
}

export function getEnvId(): string {
  return localStorage.getItem(LS_ENV_ID) || ''
}

export function setSyncEnabled(enabled: boolean): void {
  localStorage.setItem(LS_ENABLED, enabled ? 'true' : 'false')
}

export function setEnvId(envId: string): void {
  localStorage.setItem(LS_ENV_ID, envId)
}

export function getLastSyncTime(): string {
  return localStorage.getItem(LS_LAST_SYNC) || ''
}

function setLastSyncTime(): void {
  localStorage.setItem(LS_LAST_SYNC, new Date().toISOString())
}

// ---- Pending queue ----

interface PendingOp {
  type: 'push' | 'delete'
  recordId: string
  data?: HomeworkRecord
  timestamp: number
}

function getPendingOps(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PENDING) || '[]')
  } catch { return [] }
}

function savePendingOps(ops: PendingOp[]): void {
  localStorage.setItem(LS_PENDING, JSON.stringify(ops))
}

function addPendingOp(op: PendingOp): void {
  const ops = getPendingOps()
  ops.push(op)
  savePendingOps(ops)
}

function removePendingOp(index: number): void {
  const ops = getPendingOps()
  ops.splice(index, 1)
  savePendingOps(ops)
}

// ---- Status ----

export function setStatusCallback(cb: ((status: string) => void) | null): void {
  _onStatusChange = cb
}

function setStatus(status: string): void {
  _currentStatus = status
  _onStatusChange?.(status)
}

export function getStatus(): string {
  return _currentStatus
}

// ---- CloudBase operations ----

async function upsertRecord(record: HomeworkRecord): Promise<void> {
  const db = getDB()
  if (!db) throw new Error('CloudBase not ready')
  const col = db.collection('homework_records')
  await col.doc(record.id).set({
    ...record,
    deleted: record.deleted || false,
    _updatedAt: db.serverDate()
  })
}

async function markDeleted(recordId: string): Promise<void> {
  const db = getDB()
  if (!db) throw new Error('CloudBase not ready')
  const col = db.collection('homework_records')
  await col.doc(recordId).update({
    deleted: true,
    _updatedAt: db.serverDate()
  })
}

async function fetchUpdates(since: string): Promise<HomeworkRecord[]> {
  const db = getDB()
  if (!db) return []
  const col = db.collection('homework_records')
  const cond: any = { _updatedAt: db.command.gt(new Date(since)) }
  const { data } = await col.where(cond).get()
  return data as HomeworkRecord[]
}

async function fetchAllRecords(): Promise<HomeworkRecord[]> {
  const db = getDB()
  if (!db) return []
  const col = db.collection('homework_records')
  const { data } = await col.get()
  return data as HomeworkRecord[]
}

// ---- Sync logic ----

async function flushPendingQueue(): Promise<void> {
  const ops = getPendingOps()
  if (ops.length === 0) return

  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]
    try {
      if (op.type === 'push' && op.data) {
        await upsertRecord(op.data)
      } else if (op.type === 'delete') {
        await markDeleted(op.recordId)
      }
      removePendingOp(i)
    } catch {
      // Leave in queue for next attempt
    }
  }
}

async function pushLocalRecords(): Promise<void> {
  if (!isReady()) return

  const localRecords = await getAllLocalRecords()
  const cloudIds = new Set<string>()

  try {
    const all = await fetchAllRecords()
    for (const r of all) cloudIds.add(r.id)
  } catch {
    return
  }

  for (const record of localRecords) {
    if (!cloudIds.has(record.id)) {
      try {
        await upsertRecord(record)
      } catch {
        addPendingOp({ type: 'push', recordId: record.id, data: record, timestamp: Date.now() })
      }
    }
  }
}

async function pullRemoteChanges(): Promise<void> {
  if (!isReady()) return
  const lastSync = getLastSyncTime()
  if (!lastSync) return

  let updates: HomeworkRecord[]
  try {
    updates = await fetchUpdates(lastSync)
  } catch {
    return
  }

  if (updates.length > 0) {
    await upsertRecords(updates)
  }
}

async function syncCycle(): Promise<void> {
  if (!isReady()) return

  try {
    await flushPendingQueue()
    await pushLocalRecords()
    await pullRemoteChanges()
    setLastSyncTime()
    setStatus('synced')
  } catch {
    setStatus('error')
  }
}

// ---- Start/Stop ----

export async function startSync(): Promise<void> {
  await stopSync()

  const envId = getEnvId()
  if (!envId) {
    setStatus('no-env-id')
    return
  }

  setStatus('connecting')

  try {
    await initCloudBase(envId)

    // First sync: push local records + pull latest
    await pushLocalRecords()

    const lastSync = getLastSyncTime()
    if (lastSync) {
      const updates = await fetchUpdates(lastSync)
      if (updates.length > 0) {
        await upsertRecords(updates)
      }
    }

    setLastSyncTime()
    setStatus('synced')

    // Start polling
    pollTimer = setInterval(syncCycle, POLL_INTERVAL)
  } catch (e: any) {
    const msg = e?.message || e?.errMsg || e?.error?.message || (typeof e === 'object' ? JSON.stringify(e) : String(e)) || 'unknown'
    setStatus(`error: ${msg}`)
  }
}

export async function stopSync(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  await stopCloudBase()
  setStatus('closed')
}

// ---- Public API for record operations ----

export async function syncPushRecord(record: HomeworkRecord): Promise<void> {
  if (!isSyncEnabled() || !isReady()) {
    addPendingOp({ type: 'push', recordId: record.id, data: record, timestamp: Date.now() })
    return
  }
  try {
    await upsertRecord(record)
  } catch {
    addPendingOp({ type: 'push', recordId: record.id, data: record, timestamp: Date.now() })
  }
}

export async function syncDeleteRecord(recordId: string): Promise<void> {
  if (!isSyncEnabled() || !isReady()) {
    addPendingOp({ type: 'delete', recordId, timestamp: Date.now() })
    return
  }
  try {
    await markDeleted(recordId)
  } catch {
    addPendingOp({ type: 'delete', recordId, timestamp: Date.now() })
  }
}
