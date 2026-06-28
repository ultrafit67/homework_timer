let logs: { level: string; text: string; timestamp: number }[] = []
const MAX_LOGS = 200

const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

let patched = false

function formatArg(a: unknown): string {
  if (typeof a === 'string') return a
  if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '')
  try { return JSON.stringify(a) } catch { return String(a) }
}

export function patchConsole() {
  if (patched) return
  patched = true

  console.log = (...args) => {
    const text = args.map(formatArg).join(' ')
    logs.push({ level: 'log', text, timestamp: Date.now() })
    if (logs.length > MAX_LOGS) logs.shift()
    originalLog.apply(console, args)
  }

  console.error = (...args) => {
    const text = args.map(formatArg).join(' ')
    logs.push({ level: 'error', text, timestamp: Date.now() })
    if (logs.length > MAX_LOGS) logs.shift()
    originalError.apply(console, args)
  }

  console.warn = (...args) => {
    const text = args.map(formatArg).join(' ')
    logs.push({ level: 'warn', text, timestamp: Date.now() })
    if (logs.length > MAX_LOGS) logs.shift()
    originalWarn.apply(console, args)
  }
}

export function getCapturedLogs(): string {
  return logs.map(l => {
    const time = new Date(l.timestamp).toISOString().slice(11, 23)
    return `${time} [${l.level}] ${l.text}`
  }).join('\n')
}

export function clearCapturedLogs() {
  logs = []
}
