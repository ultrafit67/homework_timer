# AGENTS.md - homework_app

A PWA homework timer for 2 users (老大, 老二): 3 tab views (Timer, Stats, Records), all data in IndexedDB, Chinese UI.

## Architecture

```
src/
   badges.ts        — Badge definitions (streak/time), BadgeEntry, computeBadges()
   types.ts         — Subject, HomeworkRecord, USERS, Grade, getSubjectsForGrade, SUBJECT_COLORS, SUBJECT_ICONS
   utils.ts         — generateId, formatTime, formatDuration, getWeekId, computeStats,
                      loadGrade, saveGrade, loadUserNames, saveUserName, auto-backup
   db.ts            — IndexedDB via `idb` v8 (singleton, lazy migration, v3)
   hooks/
     useTimer.ts    — Timer state machine (idle → subjectSelected → timing → paused)
     useRecords.ts  — CRUD + computed stats + user/subject filter
     useLocalSync.ts — LAN P2P sync via WebRTC (multi-QR handshake, data channel exchange)
     useAI.ts       — DeepSeek API call hook, loading/error state, history management
   components/
     TimerPanel.tsx — Single-user timer panel (config dialog: editable name + grade, reset defaults)
     SubjectButton, TimerDisplay, ConfirmDialog
     RecordItem, EditRecordDialog
     LocalSync.tsx  — LAN sync UI: QR scanner/generator, camera, self-test, sync status
     ApiKeyDialog.tsx — DeepSeek API Key config dialog (on timer page)
     AIAnalysis.tsx  — AI analysis section (on records page): trigger, result render, history list
     BadgeWall.tsx   — Badge wall dialog: per-user streak/time badges, unlocked/locked states, unlock date detail
   pages/           — TimerView, StatsView, RecordsView (tab content)
   App.tsx          — BrowserRouter + Routes + BottomNav + sync status indicator
   styles.css       — Single CSS file, mobile-first (max-width 480px), BEM naming
```

## Critical gotchas

- **React 19 Strict Mode double-invokes state updaters.** `useTimer.complete()` reads from a `stateRef` (not closure state) to avoid the double-invoke bug where `setState` updater callbacks execute twice.
- **`idb` v8 upgrade callback must NOT be async.** `openDB` resolves on `onsuccess` immediately after `onupgradeneeded` returns — it does NOT wait for async operations inside the callback. DB migrations must be done lazily after `getDb()` resolves (see `db.ts:migrateRecords()`).
- **`crypto.randomUUID()` fallback.** `generateId()` in `utils.ts` falls back to `Date.now() + Math.random()` if `crypto.randomUUID` is unavailable.
- **`noUnusedLocals` / `noUnusedParameters`** are enforced. Any unused import, variable, or parameter causes `tsc -b` to fail.
- **Timer precision via `Date.now()`.** `useTimer` stores `timingStart` (ms timestamp) + `accruedMs`, computes elapsed as `accruedMs + (Date.now() - timingStart)`. `setInterval` only triggers re-render, not accumulation. No drift from browser throttling.
- **Timer state persisted to `localStorage`.** Timer state (status, selectedSubject, accruedMs, timingStart) is saved to `localStorage` on every change and restored on mount. This survives page refresh/reload. Keyed by `userName` (`timer-state-{userName}`). Cleared on complete/reset. This means the timer survives browser tab restorations that trigger a page reload.
- **Pomodoro state persisted to `localStorage`.** `usePomodoro(storageKey)` saves state (phase, subject, durations, cycle, `deadline` timestamp, `savedRemaining`) on meaningful changes (`isPaused` included). Restored via lazy initializers on mount. **Running timers use `deadline` for accurate elapsed time; paused/idle timers save `savedRemaining` directly** — prevents stale deadline drift on remount (e.g. switching modes). A mount-restore `useEffect` auto-starts the countdown when restored as running (`!isPaused && remainingSeconds > 0`). Expired timers during refresh auto-transition (focus→break, break→next focus, left paused for safety). Keyed by `pomodoro-{userIndex}`.

## Multi-user features

- Two users: default names `USERS = ['老大', '老二']` in `types.ts`. **Editable** — saved to `homework-name-0/1` in localStorage.
- `loadUserNames()` (in `utils.ts`) returns effective names (localStorage override → `USERS` fallback).
- All UI tabs (Stats, Records, manual form, EditRecordDialog) use `loadUserNames()` instead of `USERS` directly, so name edits reflect immediately on re-render.
- `HomeworkRecord.user` (string) stores which user the record belongs to. Required field.
- `useTimer(userName)` accepts userName, `complete()` returns record with that user.
- `useRecords` defaults `userFilter` to `loadUserNames()[0]`. Stats/Records pages show user tab bar (no "全部").
- Data migration (v2→v3) runs lazily in `migrateRecords()`: assigns `USERS[0]` to existing records with no `user` field.

## Grade-based subject filtering

- Click user name on timer page → user config dialog (name text input + grade picker 1-9 + 全部).
- Grade saved to localStorage by **user index** (`homework-grade-0`, `homework-grade-1`), not by name — renaming doesn't lose grade setting.
- Subjects shown per grade (cumulative):
  - 1-2: 语文, 数学, 背诵
  - 3-5: +英语
  - 6: +道法
  - 7: +历史
  - 8: +物理
  - 9: +化学
- `getSubjectsForGrade(grade)` in `types.ts`, `loadGrade(userIndex)/saveGrade(userIndex)` in `utils.ts`.
- Manual record form also filters subjects by selected user's grade.

## Additional features

- **CSS bar charts** in Stats page: daily subject breakdown + weekly per-day totals, pure CSS (no chart library)
- **SVG trend chart** in Stats page: line chart showing daily/weekly duration trends per subject
- **Manual form quick entry**: toggle between exact datetime input and minutes-based quick entry (auto-calculates start from current time)
- **Date range filter** on Records page: filter records by date range with start/end date pickers
- **Pomodoro timer**: toggle on TimerPanel switches between 普通/番茄钟; PomodoroTimer component with presets (25+5, 45+10, 50+10), countdown + progress bar, notification/vibration/beep on phase change, auto-saves record on focus complete, auto-loop (focus→break→next focus)
- **Auto-backup dual system**: `db.backupAllRecords()` saves to `homework-backup` (for "从备份恢复" button); auto-backup in `utils.ts` saves to `homework-backup-{id}` entries + optional File System API directory write. On mount backup ensures restore key always exists. Permission re-check (queryPermission/requestPermission) before File System writes to handle stale handles across page reloads. Race-condition guard: re-checks `hasBackupToday()` after async `getAllRecords()` to prevent duplicate backups.
- **Subject colors/icons**: `SUBJECT_COLORS` + `SUBJECT_ICONS` in types.ts, applied to buttons, records, stats bars, and trend chart
- **LAN P2P sync**: QR-based WebRTC sync between two devices on same LAN, no server required
- **AI analysis** (DeepSeek): API key config on timer page; analysis section on records page, triggered with current filter; markdown result with custom lightweight renderer (no deps); history saved to localStorage (last 20)
- **Export/Import with config**: JSON export includes user names + grades in versioned wrapper; import compatible with old format
- **User config reset**: config dialog has "重置默认值" button to reset name/grade to defaults
- **Clear all records**: "清除所有记录" button on Records page with confirmation dialog, permanently removes all records from IndexedDB
- **Feedback**: "问题反馈" button on timer page opens dialog; submits via Formspree POST (no backend required)
- **Badge wall**: "徽章墙" button on timer page opens dialog; per-user streak (三天/7天/30天/100天) and cumulative time (10h/50h/100h/200h/1000h) badges; unlocked badges show colored icon + name + unlock date, locked badges show gray silhouette + "???" + vague clue; unlock time frozen to localStorage on first achievement

## Timer state machine (`useTimer.ts`)

| Status | Meaning | Buttons shown |
|---|---|---|
| `idle` | No subject selected | (none) |
| `subjectSelected` | Subject chosen, not started | 开始 |
| `timing` | Timer running | 暂停 + 完成 |
| `paused` | Timer paused | 继续 + 完成 |

- `timer.complete()` returns a `HomeworkRecord` (without saving — caller handles `addRecord`).
- `timer.pause()`, `timer.resume()` toggle the paused state.
- Timer display shows pulsing animation when paused.

## Pomodoro state machine (`usePomodoro.ts`)

| Phase | Meaning | Buttons shown |
|---|---|---|
| `idle` | No subject selected | (none — subject grid visible) |
| `subjectSelected` | Subject chosen | 开始专注 |
| `focusing` | Countdown running | 暂停/继续 + 结束 |
| `break` | Break countdown running | 暂停/继续 + 跳过休息 |

- `usePomodoro(storageKey)` persists state to `sessionStorage` keyed by `pomodoro-{userIndex}`.
- Deadlines are restored from `sessionStorage` for accurate remaining time across page reloads.
- `onFocusComplete()` callback auto-saves a `HomeworkRecord` with `addRecord()`.
- Notification (Web Notification API) + vibration + audio beep on phase transitions (subject to browser support).
- Three presets: 25+5, 45+10, 50+10 minutes (focus+break). Duration toggle disabled while running.
- Cycle counter: increments each full focus→break→focus loop.
- Progress bar shows fraction of current phase elapsed.

## Compact layout (timer page)

- Two `TimerPanel` stacked vertically with a divider.
- User name + timer display in same flex row (两端对齐).
- Subject buttons: fixed 44px height, 16px font, 6px gap.
- Timer font: 32px in panel header, 56px standalone.
- Panel padding: 8px vertical.

## Commands

- `npm run dev` — Vite dev server on `0.0.0.0` (network-accessible, HTTPS via `@vitejs/plugin-basic-ssl` for camera/microphone access). Accept the self-signed cert warning in browser.
- `npm run build` — `tsc -b && vite build` (both typecheck and bundle). **Run this, not `tsc` alone.**
- `npm run preview` — Vite preview of built output
- No lint, test, or format commands configured.

## DB schema (IndexedDB v3)

- Store: `homework-timer.records` (keyPath: `id`)
- Indexes: `date`, `subject`, `startTime`, `user` (added in v3)
- `db.ts` exports: `addRecord`, `getRecordsByDate`, `getRecordsInRange`, `getAllRecords`, `deleteRecord`, `updateRecord`, `importRecords`, `getDateGroups`, `renameUserRecords`, `backupAllRecords`, `restoreFromBackup`, `getAllRecordsForSync`, `hardDeleteRecord`, `upsertRecords`, `clearAllRecords`
- Lazy migration in `getAllRecords()`: subject rename (v1→v2), default user assignment (v2→v3)
- Soft delete: `deleteRecord()` sets `deleted: true` instead of removing; `getAllRecords()` filters out deleted; `getAllRecordsForSync()` returns all including deleted (for sync)

## AI analysis (DeepSeek)

- API key config on timer page via `ApiKeyDialog`; key stored in `localStorage` (`homework-ai-key`)
- Collapsible analysis section on records page via `AIAnalysis.tsx`, inserted between date filter and record list
- `useAI` hook handles API call (`POST https://api.deepseek.com/v1/chat/completions`), loading/error state, AbortController for cancellation
- Prompt includes: user name, grade, time range, per-subject totals/duration/count, daily trend data
- Results rendered with custom `MarkdownRenderer` (no dependencies) — handles headings, bold, inline code, links, code blocks, lists, horizontal rules
- History saved to `localStorage` (`homework-ai-history`), last 20 entries, viewable/deletable in toggleable list
- Bundle impact: ~9KB (custom renderer only, no unified/remark/rehype dependency chain)

## LAN sync (P2P WebRTC, no server)

- Opt-in via QR button on timer page → `useLocalSync` hook manages WebRTC peer connection + data channel
- **Multi-QR handshake** (2 QRs each direction): sender creates Offer → gzip-compressed + base64 → split into 2 QR codes → scanner scans both sequentially → scanner creates Answer → gzip-compressed + base64 → split into 2 QR codes → sender scans both → `ondatachannel` fires, data channel opens
- SDP preprocessing via `cleanSDP()`: removes `a=extmap-allow-mixed`, `a=msid-semantic`, `a=ice-options:trickle`; strips `generation N` / `network-cost N` from ICE candidates; dedup IPv4 host candidates; filters out TCP + IPv6 candidates
- **gzip compression** (`CompressionStream`): reduces SDP size by ~53%, enabling 2-QR handshake (4 would be needed without compression)
- SDP data base64-encoded in QR content to avoid control-character corruption in QR encode→image→scan→decode pipeline
- Sequential single-QR display with "下一个" button and progress indicator (scanned X/Y)
- QR: `qrcode` library, `errorCorrectionLevel: 'L'`, `width: 320`, `margin: 2`
- Camera: `jsQR` for scanning, `@vitejs/plugin-basic-ssl` for HTTPS (required for camera access on mobile)
- STUN: `stun:stun.l.google.com:19302` (no TURN)
- **Data exchange**: both sides call `getAllRecords()`, swap via `dc.send()`, then `upsertRecords()` on received data
- **Message buffering**: `dc.onmessage` set permanently in `setupDataChannel()` to a buffer queue (`msgBufferRef`), preventing message loss during async DB reads. `exchangeRecords()` checks buffer first, then sets a fresh timeout-based waiter
- **User config sync**: payload includes `userNames` + `userGrades`; merge rule: if local value equals default (`USERS[i]` for name, `0` for grade), adopt remote value
- Self-test: "自检" button in dialog creates two in-page peer connections + chunk consistency test (total=1/2/3/4/5/10), bypasses QR/camera
- Sync status: floating indicator (`sync-indicator`) at bottom-right, hidden by default
- `a=max-message-size` preserved in SDP to keep 256KB message limit
- Connection timeout (30s) cleared at each progress point (scanner receives offer, sender receives answer, data channel opens)

## Export/Import JSON

- Records export includes `version: 2`, `records`, `userNames`, `userGrades` in a single JSON object
- Import detects format: old (plain array) or v2 wrapper; restores both records and user config
- `backupAllRecords()` / `restoreFromBackup()` also include user config


## Routes

| Path | Component | BottomNav tab |
|---|---|---|
| `/` | TimerView | 计时 |
| `/stats` | StatsView | 统计 |
| `/records` | RecordsView | 记录 |

## Deployment

- **github**: git push后会自动部署到  https://ultrafit67.github.io/homework_timer/
- **Surge.sh** (已弃用): 部署地址: `https://ultrafit67-homework.surge.sh`
- **手机访问**: 开发模式 `npm run dev` 直接局域网访问 `https://<电脑IP>:5173` 即可（自签名证书，浏览器确认安全警告）。

## GitHub

- add ssh keys in https://github.com/settings/keys
- git remote set-url origin git@github.com:ultrafit67/homework_timer.git
- git pull origin main
- git push -u origin main

## Known constraints

- No tests exist. No testing framework installed (Playwright in devDeps but not configured).
- All user-facing text is in Chinese (Simplified). Subject names, button labels, error messages, etc.
- Timer uses `setInterval` (1s tick) — not `requestAnimationFrame`. Elapsed time is approximate, not frame-accurate.
- Record `startTime`/`endTime` are ISO 8601 UTC strings. `formatTime()` converts to local time for display.
- Manual record form uses `datetime-local` inputs, converted to ISO strings via `new Date(localStr).toISOString()`.
- Surge deployment blocked (API server `surge.surge.sh:443` unreachable).
- User names are stored per-index in localStorage (`homework-name-0/1`). Renaming a user in the config dialog **auto-updates** all existing IndexedDB records for that user (via `renameUserRecords()` in `db.ts`).
- **TimerPanel** receives `userName` as prop + `userIndex` (0/1) for localStorage key access; grade is stored by index, name is overridable.
- **Config dialog reset**: "重置默认值" calls `saveUserName(i, USERS[i])` + `saveGrade(i, 0)`.
- **TimerPanel** mode toggle (普通/番茄钟) persisted to `sessionStorage` (`timer-mode-{userIndex}`), restored on mount.
- **Auto-backup** uses two mechanisms: `db.backupAllRecords()` saves to `homework-backup` localStorage key for "从备份恢复"; auto-backup in `utils.ts` saves to `homework-backup-{id}` entries + optional File System directory. Permission re-check required before File System writes across sessions.
- **LAN sync** requires HTTPS (camera access). Dev server uses `@vitejs/plugin-basic-ssl`.
- **Data channel message buffering**: `dc.onmessage` must be set before `await getAllRecords()` to avoid lost-message race. `setupDataChannel` uses persistent `onmessage` → `msgBufferRef` queue.
