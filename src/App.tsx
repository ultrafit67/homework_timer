import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { TimerView } from './pages/TimerView'
import { StatsView } from './pages/StatsView'
import { RecordsView } from './pages/RecordsView'
import { useRecords } from './hooks/useRecords'

function AppContent() {
  const { refresh } = useRecords()

  return (
    <div className="app">
      <div className="app__content">
        <Routes>
          <Route path="/" element={<TimerView onRecordAdded={refresh} />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/records" element={<RecordsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
