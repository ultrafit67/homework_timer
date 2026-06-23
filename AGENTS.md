# AGENTS.md - homework_app

A PWA homework timer for 2 users (刘梦珊, 刘梦苒): 3 tab views (Timer, Stats, Records), all data in IndexedDB, Chinese UI.

## Architecture

```
src/
  types.ts         — Subject, HomeworkRecord, USERS, Grade, getSubjectsForGrade
  utils.ts         — generateId, formatTime, formatDuration, getWeekId, computeStats, loadGrade, saveGrade
  db.ts            — IndexedDB via `idb` v8 (singleton, lazy migration, v3)
  hooks/
    useTimer.ts    — Timer state machine (idle → subjectSelected → timing → paused)
    useRecords.ts  — CRUD + computed stats + user/subject filter
  components/
    TimerPanel.tsx — Single-user timer panel (header + grade picker + subject grid + buttons)
    SubjectButton, TimerDisplay, ConfirmDialog
    RecordItem, EditRecordDialog
    TotalTimeCard, RankingItem
  pages/           — TimerView, StatsView, RecordsView (tab content)
  App.tsx          — BrowserRouter + Routes + BottomNav
  styles.css       — Single CSS file, mobile-first (max-width 480px), BEM naming
```

## Critical gotchas

- **`idb` v8 upgrade callback must NOT be async.** `openDB` resolves on `onsuccess` immediately after `onupgradeneeded` returns — it does NOT wait for async operations inside the callback. DB migrations must be done lazily after `getDb()` resolves (see `db.ts:migrateRecords()`).
- **React 19 Strict Mode double-invokes state updaters.** `useTimer.complete()` reads from a `stateRef` (not closure state) to avoid the double-invoke bug where `setState` updater callbacks execute twice.
- **`crypto.randomUUID()` fallback.** `generateId()` in `utils.ts` falls back to `Date.now() + Math.random()` if `crypto.randomUUID` is unavailable.
- **`noUnusedLocals` / `noUnusedParameters`** are enforced. Any unused import, variable, or parameter causes `tsc -b` to fail.

## Multi-user features

- Two fixed users: `USERS = ['刘梦珊', '刘梦苒']` in `types.ts`.
- `HomeworkRecord.user` (string) stores which user the record belongs to. Required field.
- `useTimer(userName)` accepts userName, `complete()` returns record with that user.
- `useRecords` defaults `userFilter` to `USERS[0]`. Stats/Records pages show user tab bar (no "全部").
- Data migration (v2→v3) runs lazily in `migrateRecords()`: assigns `USERS[0]` to existing records with no `user` field.

## Grade-based subject filtering

- Click user name on timer page → grade picker dialog (1-9 + 全部).
- Grade saved to localStorage (`homework-grade-{userName}`).
- Subjects shown per grade (cumulative):
  - 1-2: 语文, 数学
  - 3-5: +英语
  - 6: +道法
  - 7: +历史
  - 8: +物理
  - 9: +化学
- `getSubjectsForGrade(grade)` in `types.ts`, `loadGrade()/saveGrade()` in `utils.ts`.
- Manual record form also filters subjects by selected user's grade.

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

## Compact layout (timer page)

- Two `TimerPanel` stacked vertically with a divider.
- User name + timer display in same flex row (两端对齐).
- Subject buttons: fixed 44px height, 16px font, 6px gap.
- Timer font: 32px in panel header, 56px standalone.
- Panel padding: 8px vertical.

## Commands

- `npm run dev` — Vite dev server on `0.0.0.0` (network-accessible)
- `npm run build` — `tsc -b && vite build` (both typecheck and bundle). **Run this, not `tsc` alone.**
- `npm run preview` — Vite preview of built output
- No lint, test, or format commands configured.

## DB schema (IndexedDB v3)

- Store: `homework-timer.records` (keyPath: `id`)
- Indexes: `date`, `subject`, `startTime`, `user` (added in v3)
- `db.ts` exports: `addRecord`, `getRecordsByDate`, `getRecordsInRange`, `getAllRecords`, `deleteRecord`, `updateRecord`, `importRecords`, `getDateGroups`
- Lazy migration in `getAllRecords()`: subject rename (v1→v2), default user assignment (v2→v3)

## Routes

| Path | Component | BottomNav tab |
|---|---|---|
| `/` | TimerView | 计时 |
| `/stats` | StatsView | 统计 |
| `/records` | RecordsView | 记录 |

## Deployment

- **Surge.sh** (当前使用): `npm run build && npx surge dist/ --domain <name>.surge.sh`
  - 需代理访问。当前环境使用 SOCKS5 代理 `socks5://192.168.31.1:7890`
  - Node.js 不原生支持 SOCKS5，部署时需通过 `proxy-bootstrap.mjs` 注入 `SocksProxyAgent`:
    ```bash
    NODE_OPTIONS="--import proxy-bootstrap.mjs" node /path/to/surge/bin/surge dist/ --domain <name>.surge.sh
    ```
  - 首次部署会提示输入邮箱和密码注册账号。已注册账号和密码存储在 `~/.surge/` 中。
  - 当前部署地址: `https://ultrafit67-homework.surge.sh`
- **Vercel**: `npx vercel deploy dist/ --prod` — 当前环境无直连 HTTPS 能力，需通过 SOCKS5 代理（方法同上）。
- **手机访问**: 开发模式 `npm run dev` 直接局域网访问 `http://<电脑IP>:5173` 即可。

## GitHub

- add ssh keys in https://github.com/settings/keys
- git remote set-url origin git@github.com:ultrafit67/homework_app.git
- git pull origin main
- git push -u origin main

## Known constraints

- No tests exist. No testing framework installed (Playwright in devDeps but not configured).
- All user-facing text is in Chinese (Simplified). Subject names, button labels, error messages, etc.
- Timer uses `setInterval` (1s tick) — not `requestAnimationFrame`. Elapsed time is approximate, not frame-accurate.
- Record `startTime`/`endTime` are ISO 8601 UTC strings. `formatTime()` converts to local time for display.
- Manual record form uses `datetime-local` inputs, converted to ISO strings via `new Date(localStr).toISOString()`.
- Surge deployment blocked (API server `surge.surge.sh:443` unreachable).
