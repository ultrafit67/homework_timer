# Multi-User Timer Support

## Overview
Support two fixed users (刘梦珊, 刘梦苒) sharing the same device. Each user can independently select a subject, start/pause/resume their timer, and complete sessions. Stats and records pages filter by user via tabs.

## Data Model

### HomeworkRecord
- Add `user: string` field (one of 刘梦珊, 刘梦苒)
- IndexedDB version 2 → 3: add `user` index
- Existing records without `user` field default to 刘梦珊 (via migration)

### DB Migration (v2 → v3)
- `openDB` upgrade callback creates `user` index
- Lazy migration in `migrateRecords()` assigns `user: '刘梦珊'` to records missing the field

## Timer Page
Two independent timer panels stacked vertically, each identical in structure:

```
┌─ 刘梦珊 ──────────────────┐
│  [科目网格]  00:00:00     │
│  [开始 / 暂停 / 完成]     │
└───────────────────────────┘
┌─ 刘梦苒 ──────────────────┐
│  [科目网格]  00:00:00     │
│  [开始 / 暂停 / 完成]     │
└───────────────────────────┘
         [手动记录]
```

- Each panel uses its own `useTimer()` hook instance
- Each panel shows the user's name at top
- Independent state machines: idle → subjectSelected → timing ⇄ paused → completed
- Both can run simultaneously
- Subject grid same as current (7 subjects)
- Manual record form adds a user selector (dropdown/toggle between the two)

## Stats Page
- Tab bar below page title: `[刘梦珊] [刘梦苒] [全部]`
- Filter all stats (daily total, weekly total, subject rankings, weekly rankings) by selected user
- "全部" shows combined data from both users (current behavior)

## Records Page
- Same tab bar as Stats: `[刘梦珊] [刘梦苒] [全部]`
- Record list filtered by selected user
- Each record shows user name
- Edit dialog shows user field
- Manual record form lets user select which user the record belongs to

## Implementation Plan

### Phase 1: Data Layer
1. `types.ts`: Add `user` to `HomeworkRecord` (optional for backward compat)
2. `db.ts`: Bump `DB_VERSION` to 3, add `user` index in upgrade, update `migrateRecords()` to set default user

### Phase 2: Timer
3. `TimerView.tsx`: Render two timer panels using two `useTimer()` instances
4. Each panel: user label + subject grid + timer display + action buttons
5. Manual record form: add user selector

### Phase 3: Stats + Records
6. `StatsView.tsx`: Add user tab bar, filter `useRecords` data by user
7. `RecordsView.tsx`: Add user tab bar, filter records by user
8. `EditRecordDialog.tsx`: Show/edit user field
9. `useRecords.ts`: Accept optional `user` filter parameter

### Phase 4: Polish
10. `styles.css`: Styles for user panels, tab bar, manual form user selector
