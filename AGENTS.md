# AGENTS.md - homework_app

A PWA homework timer: 3 tab views (Timer, Stats, Records), all data in IndexedDB, Chinese UI.

## Architecture

```
src/
  types.ts         — Subject union, HomeworkRecord interface, TimeStats
  utils.ts         — generateId, formatTime, formatDuration, getWeekId, computeStats
  db.ts            — IndexedDB via `idb` v8 (singleton, lazy migration)
  hooks/
    useTimer.ts    — Timer state machine (idle → subjectSelected → timing)
    useRecords.ts  — CRUD + computed stats, shared across Stats/Records views
  components/      — Stateless presentational components
  pages/           — TimerView, StatsView, RecordsView (tab content)
  App.tsx          — BrowserRouter + Routes + BottomNav
  styles.css       — Single CSS file, mobile-first (max-width 480px)
```

## Critical gotchas

- **`idb` v8 upgrade callback must NOT be async.** `openDB` resolves on `onsuccess` immediately after `onupgradeneeded` returns — it does NOT wait for async operations inside the callback. DB migrations must be done lazily after `getDb()` resolves (see `db.ts:migrateRecords()`).
- **React 19 Strict Mode double-invokes state updaters.** `useTimer.complete()` reads from a `stateRef` (not closure state) to avoid the double-invoke bug where `setState` updater callbacks execute twice.
- **`crypto.randomUUID()` fallback.** `generateId()` in `utils.ts` falls back to `Date.now() + Math.random()` if `crypto.randomUUID` is unavailable.

## Commands

- `npm run dev` — Vite dev server on `0.0.0.0` (network-accessible)
- `npm run build` — `tsc -b && vite build` (both typecheck and bundle). **Run this, not `tsc` alone.**
- `npm run preview` — Vite preview of built output
- No lint, test, or format commands configured.
- `node_modules` only in `.gitignore` — no `.env`, no build artifacts committed.

## TypeScript

- `strict: true`, `noUnusedLocals`, `noUnusedParameters` enforced. Any unused import or variable causes build failure.
- `moduleResolution: "bundler"`, `isolatedModules: true` — single-file compilation, no const enum exports.

## Styling

- Single `styles.css`, BEM naming (`.block__element--modifier`), CSS custom properties for theme.
- Viewport locked: `user-scalable=no`, `max-scale=1.0` — mobile-only.
- Layout: `.app` flex column, 480px max-width centered, bottom nav 60px.

## Data layer

- IndexedDB store: `homework-timer.records` with indexes on `date`, `subject`, `startTime`. Version 2.
- `db.ts` exports: `addRecord`, `getRecordsByDate`, `getRecordsInRange`, `getAllRecords`, `deleteRecord`, `updateRecord`, `getDateGroups`.
- All functions are async, use `getDb()` singleton (lazy init, cached).
- Subject name migration (v1→v2: 语→语文, 数→数学, 外→英语) runs lazily on first `getAllRecords()` call, not in the upgrade callback.

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

## Known constraints

- No tests exist. No testing framework installed (Playwright in devDeps but not configured).
- All user-facing text is in Chinese (Simplified). Subject names, button labels, error messages, etc.
- Timer uses `setInterval` (1s tick) — not `requestAnimationFrame`. Elapsed time is approximate, not frame-accurate.
- Record `startTime`/`endTime` are ISO 8601 UTC strings. `formatTime()` converts to local time for display.
- Manual record form uses `datetime-local` inputs, converted to ISO strings via `new Date(localStr).toISOString()`.
