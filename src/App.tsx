import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { TimerView } from './pages/TimerView'
import { StatsView } from './pages/StatsView'
import { RecordsView } from './pages/RecordsView'
import { SyncSettings } from './components/SyncSettings'
import { LocalSync } from './components/LocalSync'
import { useRecords } from './hooks/useRecords'
import { backupAllRecords } from './db'
import { HomeworkRecord } from './types'
import { isSyncEnabled, startSync, stopSync, getStatus, setStatusCallback, syncPushRecord } from './sync'

const SYNC_DOT_COLORS: Record<string, string> = {
  closed: '#9CA3AF',
  'no-env-id': '#F59E0B',
  connecting: '#3B82F6',
  syncing: '#3B82F6',
  synced: '#10B981',
  error: '#EF4444'
}

function AppContent() {
  const { refresh } = useRecords()
  const [showSync, setShowSync] = useState(false)
  const [showLocalSync, setShowLocalSync] = useState(false)
  const [syncStatus, setSyncStatus] = useState(() => getStatus())

  useEffect(() => {
    if (isSyncEnabled()) {
      startSync().catch(() => {})
    }
    setStatusCallback(setSyncStatus)
    return () => {
      stopSync().catch(() => {})
      setStatusCallback(null)
    }
  }, [])

  const onRecordAdded = useCallback(async (record?: HomeworkRecord) => {
    await refresh()
    backupAllRecords().catch(e => console.warn('Auto-backup failed', e))
    if (record && isSyncEnabled()) {
      syncPushRecord(record).catch(e => console.warn('Sync push failed', e))
    }
  }, [refresh])

  const syncColor = SYNC_DOT_COLORS[syncStatus] || '#9CA3AF'

  return (
    <div className="app">
      <div className="app__content">
        <Routes>
          <Route path="/" element={<TimerView onRecordAdded={onRecordAdded} />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/records" element={<RecordsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
      <button className="sync-indicator" onClick={() => setShowSync(true)} title={`同步状态: ${syncStatus}`}>
        <span className="sync-indicator__dot" style={{ background: syncColor }} />
        <span className="sync-indicator__label">云同步</span>
      </button>
      <button className="sync-indicator sync-indicator--local" onClick={() => setShowLocalSync(true)} title="本地同步">
        <span className="sync-indicator__label">本地扫码同步</span>
      </button>

      {showSync && (
        <div className="dialog-overlay" onClick={() => setShowSync(false)}>
          <div className="dialog dialog--sync" onClick={e => e.stopPropagation()}>
            <SyncSettings />
            <div className="dialog__actions">
              <button className="btn btn--secondary btn--large" onClick={() => setShowSync(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {showLocalSync && <LocalSync open={showLocalSync} onClose={() => setShowLocalSync(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}
