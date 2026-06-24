# LocalSync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LAN device-to-device one-time sync via WebRTC + QR code handshake

**Architecture:** Two phones on same WiFi exchange IndexedDB records through WebRTC DataChannel. Signaling via two-QR handshake (Offer QR → scan → Answer QR → scan). Data merged by `upsertRecords()` (last-write-wins by ID). UI as modal dialog following existing dialog patterns.

**Tech Stack:** React 19, TypeScript, Vite 6, WebRTC (RTCPeerConnection + RTCDataChannel), `qrcode` (QR generation), `jsQR` (QR decoding), `idb` v8

---

### Task 1: Install npm packages

**Files:** `package.json`

- [ ] **Install qrcode, jsQR, and type definitions**

```bash
npm install qrcode jsQR
npm install -D @types/qrcode
```

- [ ] **Verify install**

```bash
npm ls qrcode jsQR @types/qrcode
```

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add qrcode, jsQR for LocalSync QR handshake"
```

---

### Task 2: Create `src/hooks/useLocalSync.ts`

**Files:**
- Create: `src/hooks/useLocalSync.ts`

Hook manages WebRTC connection, two-QR handshake, and IndexedDB data exchange.

**Flow:**
1. **Sender** creates PC + DataChannel → generates Offer SDP → shows QR
2. **Scanner** creates PC → scans Offer QR → generates Answer SDP → shows QR
3. **Sender** scans Answer QR → ICE connects → DataChannel opens
4. Role-based protocol: sender pushes records → scanner upserts + sends own → sender upserts

```typescript
import { useCallback, useRef, useState } from 'react'
import { getAllRecords, upsertRecords } from '../db'
import { HomeworkRecord } from '../types'

export type SyncStatus =
  | 'idle'
  | 'generating-offer'
  | 'showing-qr'
  | 'scanning'
  | 'connecting'
  | 'syncing'
  | 'complete'
  | 'error'

export interface SyncState {
  status: SyncStatus
  role: 'sender' | 'scanner' | null
  sdp: string | null
  stats: { sent: number; received: number }
  error: string | null
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

const CONNECTION_TIMEOUT_MS = 30_000

export function useLocalSync() {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    role: null,
    sdp: null,
    stats: { sent: 0, received: 0 },
    error: null
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  const updateStatus = useCallback((overrides: Partial<SyncState>) => {
    setState(prev => ({ ...prev, ...overrides }))
  }, [])

  const handleError = useCallback((msg: string) => {
    cleanup()
    updateStatus({ status: 'error', error: msg })
  }, [cleanup, updateStatus])

  const exchangeRecords = useCallback(async (dc: RTCDataChannel, role: 'sender' | 'scanner') => {
    updateStatus({ status: 'syncing' })

    const localRecords = await getAllRecords()
    const localCount = localRecords.length

    if (role === 'sender') {
      // Sender pushes first, then waits for scanner's response
      dc.send(JSON.stringify({ type: 'records', records: localRecords }))

      const remoteRecords = await new Promise<HomeworkRecord[]>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type === 'records') {
              dc.removeEventListener('message', handler)
              resolve(data.records as HomeworkRecord[])
            }
          } catch { /* ignore malformed */ }
        }
        dc.addEventListener('message', handler)
        setTimeout(() => {
          dc.removeEventListener('message', handler)
          reject(new Error('同步超时：未收到对方数据'))
        }, 15_000)
      })

      await upsertRecords(remoteRecords)
      updateStatus({
        status: 'complete',
        stats: { sent: localCount, received: remoteRecords.length }
      })
    } else {
      // Scanner waits for sender's records, then pushes its own back
      const remoteRecords = await new Promise<HomeworkRecord[]>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            if (data.type === 'records') {
              dc.removeEventListener('message', handler)
              resolve(data.records as HomeworkRecord[])
            }
          } catch { /* ignore malformed */ }
        }
        dc.addEventListener('message', handler)
        setTimeout(() => {
          dc.removeEventListener('message', handler)
          reject(new Error('同步超时：未收到对方数据'))
        }, 15_000)
      })

      await upsertRecords(remoteRecords)
      dc.send(JSON.stringify({ type: 'records', records: localRecords }))

      updateStatus({
        status: 'complete',
        stats: { sent: localCount, received: remoteRecords.length }
      })
    }
  }, [updateStatus])

  const setupDataChannel = useCallback((dc: RTCDataChannel, role: 'sender' | 'scanner') => {
    dc.onopen = () => {
      exchangeRecords(dc, role).catch(e => handleError(e.message))
    }
    dc.onerror = () => handleError('数据通道连接错误')
    dc.onclose = () => {
      setState(prev => {
        if (prev.status === 'syncing' || prev.status === 'connecting') {
          return { ...prev, status: 'error', error: '连接已断开' }
        }
        return prev
      })
    }
  }, [exchangeRecords, handleError])

  const startAsSender = useCallback(async () => {
    updateStatus({ status: 'generating-offer', role: 'sender' })
    cleanup()

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG)
      pcRef.current = pc

      const dc = pc.createDataChannel('sync')
      setupDataChannel(dc, 'sender')

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') resolve()
        }
        setTimeout(resolve, 2000)
      })

      const sdp = pc.localDescription?.sdp
      if (!sdp) throw new Error('无法生成 Offer SDP')

      updateStatus({ status: 'showing-qr', sdp })

      timeoutRef.current = setTimeout(() => {
        handleError('连接超时：请确保两台设备在同一网络')
      }, CONNECTION_TIMEOUT_MS)

    } catch (e) {
      handleError(e instanceof Error ? e.message : '创建连接失败')
    }
  }, [cleanup, handleError, setupDataChannel, updateStatus])

  const startAsScanner = useCallback(async () => {
    updateStatus({ status: 'scanning', role: 'scanner' })
    cleanup()

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG)
      pcRef.current = pc

      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, 'scanner')
      }

      timeoutRef.current = setTimeout(() => {
        handleError('连接超时：请确保两台设备在同一网络')
      }, CONNECTION_TIMEOUT_MS)

    } catch (e) {
      handleError(e instanceof Error ? e.message : '创建连接失败')
    }
  }, [cleanup, handleError, setupDataChannel, updateStatus])

  const setRemoteSDP = useCallback(async (sdp: string) => {
    const pc = pcRef.current
    if (!pc) { handleError('连接未初始化'); return }

    try {
      if (!pc.localDescription) {
        // Scanner receiving the Offer from QR
        await pc.setRemoteDescription({ type: 'offer', sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') { resolve(); return }
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve()
          }
          setTimeout(resolve, 2000)
        })

        const answerSdp = pc.localDescription?.sdp
        if (answerSdp) {
          updateStatus({ status: 'showing-qr', sdp: answerSdp })
        }
      } else {
        // Sender receiving the Answer from QR
        await pc.setRemoteDescription({ type: 'answer', sdp })
        updateStatus({ status: 'connecting' })
      }
    } catch (e) {
      handleError(e instanceof Error ? e.message : 'SDP 交换失败')
    }
  }, [handleError, updateStatus])

  const reset = useCallback(() => {
    cleanup()
    updateStatus({
      status: 'idle', role: null, sdp: null,
      stats: { sent: 0, received: 0 }, error: null
    })
  }, [cleanup, updateStatus])

  return { state, startAsSender, startAsScanner, setRemoteSDP, reset }
}
```

- [ ] **Commit**

```bash
git add src/hooks/useLocalSync.ts
git commit -m "feat: add useLocalSync hook for WebRTC + QR sync"
```

---

### Task 3: Create `src/components/LocalSync.tsx`

**Files:**
- Create: `src/components/LocalSync.tsx`

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { useLocalSync, SyncStatus } from '../hooks/useLocalSync'

interface LocalSyncProps {
  open: boolean
  onClose: () => void
}

const SCAN_INTERVAL_MS = 50
const MAX_SCAN_ATTEMPTS = 300

export function LocalSync({ open, onClose }: LocalSyncProps) {
  const { state, startAsSender, startAsScanner, setRemoteSDP, reset } = useLocalSync()

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [textSdp, setTextSdp] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.sdp && state.status === 'showing-qr') {
      QRCode.toDataURL(state.sdp, { width: 256, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null))
    } else {
      setQrDataUrl(null)
    }
  }, [state.sdp, state.status])

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      let attempts = 0
      scanTimerRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        if (video.readyState < video.HAVE_CURRENT_DATA) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
          stopCamera()
          setRemoteSDP(code.data)
          return
        }

        attempts++
        if (attempts > MAX_SCAN_ATTEMPTS) {
          stopCamera()
          setShowTextInput(true)
        }
      }, SCAN_INTERVAL_MS)
    } catch {
      setShowTextInput(true)
    }
  }, [setRemoteSDP, stopCamera])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!open) {
      stopCamera()
      reset()
      setQrDataUrl(null)
      setTextSdp('')
      setShowTextInput(false)
    }
  }, [open, reset, stopCamera])

  if (!open) return null

  const handleStartSender = () => { reset(); startAsSender() }
  const handleStartScanner = () => { reset(); startAsScanner(); setTimeout(startCamera, 100) }
  const handleTextSubmit = () => { if (textSdp.trim()) { setRemoteSDP(textSdp.trim()); setShowTextInput(false) } }
  const handleCopyText = async () => { if (state.sdp) await navigator.clipboard.writeText(state.sdp) }

  const statusLabels: Record<SyncStatus, string> = {
    idle: '',
    'generating-offer': '正在准备连接…',
    'showing-qr': state.role === 'sender' ? '请对方扫描此二维码' : '请扫描对方设备上的二维码',
    scanning: '正在扫描二维码…',
    connecting: '正在建立连接…',
    syncing: '正在同步数据…',
    complete: '', error: ''
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog--localsync" onClick={e => e.stopPropagation()}>
        <h3 className="dialog__title">本地同步</h3>

        {state.status === 'idle' && (
          <div className="localsync__mode-select">
            <button className="btn btn--primary btn--large" onClick={handleStartSender}>
              显示二维码
            </button>
            <div className="localsync__or">或</div>
            <button className="btn btn--secondary btn--large" onClick={handleStartScanner}>
              扫码同步
            </button>
          </div>
        )}

        {(state.status === 'generating-offer' || state.status === 'connecting' || state.status === 'syncing') && (
          <div className="localsync__progress">
            <div className="localsync__spinner" />
            <p className="localsync__progress-text">{statusLabels[state.status]}</p>
          </div>
        )}

        {state.status === 'showing-qr' && qrDataUrl && (
          <div className="localsync__qr-section">
            <p className="localsync__hint">{statusLabels[state.status]}</p>
            <img src={qrDataUrl} alt="QR Code" className="localsync__qr-image" />
            {state.role === 'sender' ? (
              <div className="localsync__text-fallback">
                <button className="btn btn--text" onClick={handleCopyText}>复制二维码文字</button>
                <button className="btn btn--text" onClick={() => setShowTextInput(true)}>手动输入对方信息</button>
              </div>
            ) : (
              <p className="localsync__hint localsync__hint--secondary">扫码完成后点击下方「我已扫描」</p>
            )}
          </div>
        )}

        {state.status === 'showing-qr' && state.role === 'scanner' && !qrDataUrl && (
          <div className="localsync__progress">
            <div className="localsync__spinner" />
            <p>正在生成二维码…</p>
          </div>
        )}

        {state.status === 'scanning' && (
          <div className="localsync__scan-section">
            <p className="localsync__hint">{statusLabels[state.status]}</p>
            <div className="localsync__viewport">
              <video ref={videoRef} className="localsync__video" playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            {showTextInput && (
              <div className="localsync__text-input">
                <textarea
                  className="dialog__input localsync__textarea"
                  placeholder="粘贴对方二维码文字"
                  value={textSdp}
                  onChange={e => setTextSdp(e.target.value)}
                  rows={4}
                />
                <button className="btn btn--primary" onClick={handleTextSubmit} disabled={!textSdp.trim()}>
                  确认
                </button>
              </div>
            )}
            {!showTextInput && (
              <button className="btn btn--text" onClick={() => { stopCamera(); setShowTextInput(true); }}>
                无法扫码？手动输入
              </button>
            )}
          </div>
        )}

        {state.status === 'complete' && (
          <div className="localsync__complete">
            <div className="localsync__checkmark">✓</div>
            <p className="localsync__complete-text">同步完成！</p>
            <p className="localsync__stats">发送 {state.stats.sent} 条，接收 {state.stats.received} 条</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="localsync__error-section">
            <p className="localsync__error-text">{state.error}</p>
            <button className="btn btn--primary" onClick={reset}>重试</button>
          </div>
        )}

        <div className="dialog__actions">
          {(state.status === 'complete' || state.status === 'error') && (
            <button className="btn btn--secondary btn--large" onClick={onClose}>关闭</button>
          )}
          {state.status !== 'idle' && state.status !== 'complete' && state.status !== 'error' && (
            <button className="btn btn--secondary btn--large" onClick={() => { stopCamera(); reset(); }}>取消</button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/LocalSync.tsx
git commit -m "feat: add LocalSync dialog component with QR camera + display"
```

---

### Task 4: Modify `src/App.tsx` — integrate LocalSync dialog

**Files:**
- Modify: `src/App.tsx`

- [ ] **Add import and state**

At top, add:
```typescript
import { LocalSync } from './components/LocalSync'
```

After `const [showSync, setShowSync]`, add:
```typescript
const [showLocalSync, setShowLocalSync] = useState(false)
```

- [ ] **Add local sync button**

After the cloud sync indicator button, add:
```typescript
      <button className="sync-indicator sync-indicator--local" onClick={() => setShowLocalSync(true)} title="本地同步">
        <span className="sync-indicator__label">本地</span>
      </button>
```

- [ ] **Add LocalSync dialog**

After the cloud sync dialog `</div>`, add:
```typescript
      {showLocalSync && <LocalSync open={showLocalSync} onClose={() => setShowLocalSync(false)} />}
```

- [ ] **Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate LocalSync dialog into App"
```

---

### Task 5: Add LocalSync styles to `src/styles.css`

**Files:**
- Modify: `src/styles.css`

- [ ] **Append CSS at end of file**

```css
/* LocalSync */
.dialog--localsync {
  max-width: 340px;
}

.localsync__mode-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.localsync__mode-select .btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  font-size: 16px;
}

.localsync__or {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.localsync__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
}

.localsync__progress-text {
  font-size: 15px;
  color: var(--color-text-secondary);
}

.localsync__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: localsync-spin 0.8s linear infinite;
}

@keyframes localsync-spin {
  to { transform: rotate(360deg); }
}

.localsync__qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.localsync__qr-image {
  width: 220px;
  height: 220px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  image-rendering: pixelated;
}

.localsync__hint {
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.4;
}

.localsync__hint--secondary {
  font-size: 13px;
  color: var(--color-text-tertiary, #9CA3AF);
}

.localsync__text-fallback {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.localsync__scan-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.localsync__viewport {
  width: 240px;
  height: 240px;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
  position: relative;
}

.localsync__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.localsync__text-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.localsync__textarea {
  resize: none;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.4;
}

.localsync__complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
}

.localsync__checkmark {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.localsync__complete-text {
  font-size: 18px;
  font-weight: 700;
}

.localsync__stats {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.localsync__error-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.localsync__error-text {
  font-size: 14px;
  color: var(--color-error, #EF4444);
  text-align: center;
  line-height: 1.4;
}

.sync-indicator--local {
  right: 120px;
  background: var(--color-primary);
  color: white;
  width: auto;
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
}
```

- [ ] **Commit**

```bash
git add src/styles.css
git commit -m "style: add LocalSync dialog and indicator styles"
```

---

### Task 6: Build and verify

**Files:** All changed files

- [ ] **Run type check and build**

```bash
npm run build
```

Expected: `tsc -b` passes (0 errors), `vite build` produces bundle

- [ ] **Fix any type errors**

Common issues:
- `@types/qrcode` may not be needed if `qrcode` ships its own types → remove if redundant
- `noUnusedLocals`/`noUnusedParameters` — remove unused imports

```bash
npm run build
```

- [ ] **Commit final fix**

```bash
git add -A
git commit -m "fix: build fixes for LocalSync"
```

- [ ] **Show summary**

```bash
git log --oneline -10
```
