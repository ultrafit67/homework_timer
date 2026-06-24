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
    complete: '',
    error: ''
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
              <p className="localsync__hint localsync__hint--secondary">请将此二维码展示给发送方扫码</p>
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
            <p className="localsync__stats">
              发送 {state.stats.sent} 条，接收 {state.stats.received} 条
            </p>
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
