import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { TimerView } from './pages/TimerView'
import { StatsView } from './pages/StatsView'
import { RecordsView } from './pages/RecordsView'
import { LocalSync } from './components/LocalSync'
import { useRecords } from './hooks/useRecords'
import { backupAllRecords, getAllRecords } from './db'
import { HomeworkRecord } from './types'
import {
  getAutoBackupConfig, generateId, addBackup, cleanOldBackups, hasBackupToday, getBackupList,
  loadUserNames, loadGrade,
  loadDirHandle, writeBackupToDir, cleanOldBackupFiles
} from './utils'

function AppContent() {
  const { refresh } = useRecords()
  const [showLocalSync, setShowLocalSync] = useState(false)

  // Auto-backup trigger: check every 30 seconds
  useEffect(() => {
    let dirHandle: FileSystemDirectoryHandle | null = null
    loadDirHandle().then(h => { dirHandle = h })

    const check = async () => {
      const config = getAutoBackupConfig()
      if (!config.enabled) return
      if (hasBackupToday(getBackupList())) return
      const now = new Date()
      const currentMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (currentMin < config.time) return
      try {
        const all = await getAllRecords()
        const names = loadUserNames()
        const grades = [loadGrade(0), loadGrade(1)]
        const data = { version: 2, records: all, userNames: names, userGrades: grades }
        const id = generateId()
        const timestamp = new Date().toISOString()
        const json = JSON.stringify(data)
        addBackup(id, timestamp, json)
        cleanOldBackups(config.keepCount)
        if (dirHandle) {
          await writeBackupToDir(dirHandle, id, timestamp, json)
          await cleanOldBackupFiles(dirHandle, config.keepCount)
        }
      } catch (e) {
        console.warn('[AutoBackup] Failed', e)
      }
    }
    const id = setInterval(check, 30000)
    check()
    return () => clearInterval(id)
  }, [])

  const onRecordAdded = useCallback(async (_record?: HomeworkRecord) => {
    await refresh()
    backupAllRecords().catch(e => console.warn('Auto-backup failed', e))
  }, [refresh])

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
      <button className="sync-indicator sync-indicator--local" onClick={() => setShowLocalSync(true)} title="本地同步">
        <span className="sync-indicator__label">本地扫码同步</span>
      </button>

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
