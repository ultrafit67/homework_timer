# Cloud Sync Design — 腾讯云 CloudBase

## Overview

Add opt-in cloud sync via Tencent CloudBase (云开发). Sync is disabled by default — user enables it in settings and enters their Environment ID.

## Data Model

### HomeworkRecord (types.ts)

Add optional `deleted` field:

```ts
export interface HomeworkRecord {
  id: string
  subject: Subject
  startTime: string
  endTime: string
  durationSeconds: number
  date: string
  user: string
  deleted?: boolean    // <-- soft delete flag
}
```

### CloudBase Collection: `homework_records`

Each document maps to one HomeworkRecord. Document `_id` = record `id`. Fields:

| Field | Type | Notes |
|---|---|---|
| `_id` | String | record.id |
| subject, startTime, endTime, durationSeconds, date, user | as per HomeworkRecord | |
| deleted | Boolean | default false |
| `_updatedAt` | Date | CloudBase auto-timestamp |

## Components

### SyncSettings (src/components/SyncSettings.tsx)

A dialog/panel triggered from a settings button in the UI. Contains:
- **Enable/disable toggle** — stored in localStorage (`sync-enabled`)
- **Environment ID input** — shown when enabled, stored (`sync-env-id`)
- **Sync status** — "已关闭" / "同步中..." / "已同步 HH:MM" / "离线"

### cloudbase.ts

CloudBase SDK wrapper. Initialized on demand with a given env ID.

- `initCloudBase(envId)` → init SDK, login anonymous
- `getDB()` → get database reference

### sync.ts

Core sync logic. Reads settings from localStorage.

- `startSync()` — initialise CloudBase, pull remote data, push local data, start polling
- `stopSync()` — stop polling, cleanup
- `pushRecord(record)` — upsert to CloudBase
- `pushDelete(recordId)` — set deleted=true on CloudBase
- `pullUpdates()` — query records since lastSyncAt, upsert to IndexedDB
- Pending queue: offline writes stored in `sync-pending` localStorage, flushed on reconnect
- Polling interval: 30s

### db.ts changes

- `deleteRecord(id)` → set `deleted: true` instead of hard delete
- `hardDeleteRecord(id)` — actual removal (for cleanup)
- `getAllRecords()` — filter out `deleted: true` (internal call for sync bypasses this)
- Migration v4: add `deleted` index

### App.tsx changes

- On mount: read sync settings, if enabled → `startSync()`
- Add sync status dot/badge
- `onRecordAdded` / `onRecordDeleted` → trigger sync push

## Sync Flow

### Startup (sync enabled)
1. `initCloudBase(envId)` → anonymous sign-in
2. `pullUpdates()`: query `_updatedAt > lastSyncAt` → upsert into IndexedDB
3. `pushLocal()`: push records not yet in CloudBase
4. `startPolling(30s)`

### Record added (online)
1. IndexedDB: `addRecord(record)`
2. CloudBase: `collection.doc(record.id).set(record)`

### Record deleted
1. IndexedDB: set `record.deleted = true`
2. CloudBase: update `deleted: true`

### Offline
1. IndexedDB write succeeds
2. Sync push fails → save to pending queue
3. Next successful poll → flush pending queue

### Receive remote changes
1. Poll detects `_updatedAt > lastSyncAt`
2. Upsert into IndexedDB
3. Update `lastSyncAt` timestamp

## Conflict Resolution

Last-write-wins by `_updatedAt` (CloudBase server timestamp). Simultaneous edits unlikely for this use case. No CRDT needed.

## Security

- CloudBase anonymous auth enabled
- Only authenticated users can read/write
- Sync disabled by default, user explicitly enables it
