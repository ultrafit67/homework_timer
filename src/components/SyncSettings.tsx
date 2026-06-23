import { useState, useEffect } from 'react'
import { isSyncEnabled, getEnvId, setSyncEnabled, setEnvId, getStatus, setStatusCallback, startSync, stopSync } from '../sync'

const STATUS_LABELS: Record<string, string> = {
  'closed': '已关闭',
  'no-env-id': '未设置环境ID',
  'connecting': '连接中...',
  'syncing': '同步中...',
  'synced': '已同步',
  'error': '同步失败'
}

const STATUS_COLORS: Record<string, string> = {
  'closed': '#9CA3AF',
  'no-env-id': '#F59E0B',
  'connecting': '#3B82F6',
  'syncing': '#3B82F6',
  'synced': '#10B981',
  'error': '#EF4444'
}

export function SyncSettings() {
  const [enabled, setEnabled] = useState(() => isSyncEnabled())
  const [envId, setEnvIdState] = useState(() => getEnvId())
  const [status, setStatusState] = useState(() => getStatus())

  useEffect(() => {
    setStatusCallback(setStatusState)
    return () => setStatusCallback(null)
  }, [])

  const handleToggle = async (newEnabled: boolean) => {
    setEnabled(newEnabled)
    setSyncEnabled(newEnabled)

    if (!newEnabled) {
      await stopSync()
    } else {
      const stored = getEnvId()
      if (stored) {
        setEnvIdState(stored)
        await startSync()
      }
    }
  }

  const handleEnvIdChange = async (value: string) => {
    setEnvIdState(value)
    setEnvId(value)
  }

  const handleReconnect = async () => {
    if (!envId.trim()) return
    setEnvId(envId.trim())
    await startSync()
  }

  const statusKey = status.startsWith('error') ? 'error' : status
  const statusLabel = status.startsWith('error') ? status : STATUS_LABELS[status] || status
  const statusColor = STATUS_COLORS[statusKey] || '#9CA3AF'

  return (
    <div className="sync-settings">
      <h3 className="dialog__title">云同步设置</h3>

      <div className="sync-settings__row">
        <span className="sync-settings__label">启用云同步</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => handleToggle(e.target.checked)}
          />
          <span className="toggle__slider" />
        </label>
      </div>

      {enabled && (
        <>
          <div className="sync-settings__field">
            <label className="dialog__label">环境 ID</label>
            <input
              type="text"
              className="dialog__input"
              value={envId}
              onChange={e => handleEnvIdChange(e.target.value)}
              placeholder="输入 CloudBase 环境 ID"
            />
          </div>

          <div className="sync-settings__status">
            <span className="sync-settings__dot" style={{ background: statusColor }} />
            <span className="sync-settings__status-text">{statusLabel}</span>
            {statusKey === 'error' && (
              <button className="btn btn--text sync-settings__retry" onClick={handleReconnect}>
                重连
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
