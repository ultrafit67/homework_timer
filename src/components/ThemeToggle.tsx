import { useState, useEffect, useCallback, useRef } from 'react'
import { loadTheme, saveTheme, ThemeMode } from '../utils'

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'system', label: '跟随系统', icon: '○' },
  { mode: 'light', label: '日间', icon: '☀' },
  { mode: 'dark', label: '夜间', icon: '☽' },
]

function getIcon(mode: ThemeMode): string {
  return THEME_OPTIONS.find(o => o.mode === mode)?.icon ?? '○'
}

export function ThemeToggle() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ThemeMode>(loadTheme)
  const ref = useRef<HTMLDivElement>(null)

  // Sync data-theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  // Listen for system color scheme changes when in 'system' mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (mode === 'system') {
        // Touch the attribute to trigger CSS re-evaluation
        document.documentElement.setAttribute('data-theme', 'system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  // Close popup on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = useCallback((m: ThemeMode) => {
    setMode(m)
    saveTheme(m)
    setOpen(false)
  }, [])

  return (
    <div className="theme-toggle" ref={ref}>
      <button className="theme-toggle__btn" onClick={() => setOpen(o => !o)} title="切换主题">
        <span className="theme-toggle__icon">{getIcon(mode)}</span>
      </button>
      {open && (
        <div className="theme-toggle__popup">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              className={`theme-toggle__option ${mode === opt.mode ? 'theme-toggle__option--active' : ''}`}
              onClick={() => select(opt.mode)}
            >
              <span className="theme-toggle__opt-icon">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
