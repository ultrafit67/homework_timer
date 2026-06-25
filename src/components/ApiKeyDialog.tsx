import { useState } from 'react'
import { loadApiKey, saveApiKey } from '../hooks/useAI'

interface ApiKeyDialogProps {
  open: boolean
  onClose: () => void
}

export function ApiKeyDialog({ open, onClose }: ApiKeyDialogProps) {
  const [key, setKey] = useState(() => loadApiKey())

  if (!open) return null

  const handleSave = () => {
    saveApiKey(key.trim())
    onClose()
  }

  const handleClear = () => {
    setKey('')
    saveApiKey('')
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3 className="dialog__title">AI 设置</h3>

        <div className="dialog__field">
          <label className="dialog__label">DeepSeek API Key</label>
          <input
            type="password"
            className="dialog__input"
            placeholder="sk-..."
            value={key}
            onChange={e => setKey(e.target.value)}
            autoFocus
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
            在 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>platform.deepseek.com</a> 获取
          </p>
        </div>

        <div className="dialog__actions">
          <button className="btn btn--secondary" onClick={onClose}>取消</button>
          <button className="btn btn--primary" onClick={handleSave}>保存</button>
        </div>

        {key && (
          <button
            className="dialog__reset"
            onClick={handleClear}
          >
            清除 API Key
          </button>
        )}
      </div>
    </div>
  )
}
