import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { useLocalSync, SyncStatus, SelfTestResult } from '../hooks/useLocalSync'

interface LocalSyncProps {
  open: boolean
  onClose: () => void
}

const SCAN_INTERVAL_MS = 200

export function LocalSync({ open, onClose }: LocalSyncProps) {
  const { state, startAsSender, startAsScanner, setRemoteSDP, reset, runSelfTest } = useLocalSync()

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<SelfTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [senderScanning, setSenderScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.sdp && state.status === 'showing-qr') {
      QRCode.toDataURL(state.sdp, { width: 300, margin: 1, errorCorrectionLevel: 'L' })
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
      setCameraError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          '摄像头 API 不可用。请使用 HTTPS 访问（部署版本 https://ultrafit67.github.io/homework_timer/），或在 localhost 下访问。'
        )
      }

      // wait for DOM to be ready
      const waitForVideo = () => new Promise<void>((resolve) => {
        if (videoRef.current) return resolve()
        const timer = setInterval(() => {
          if (videoRef.current) { clearInterval(timer); resolve() }
        }, 20)
      })
      await waitForVideo()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream

      const video = videoRef.current!
      video.srcObject = stream

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => { video.play(); resolve() }
        video.onerror = () => reject(new Error('video element error'))
        // safety timeout: some browsers never fire loadedmetadata
        setTimeout(() => {
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            video.play().then(resolve).catch(reject)
          } else {
            reject(new Error('camera stream timeout'))
          }
        }, 5000)
      })

      if (video.videoWidth === 0) {
        throw new Error('camera stream has no video dimensions')
      }

      scanTimerRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return
        const v = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        if (v.readyState < v.HAVE_CURRENT_DATA) return

        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        ctx.drawImage(v, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
          stopCamera()
          setSenderScanning(false)
          setRemoteSDP(code.data)
        }
      }, SCAN_INTERVAL_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCameraError(msg)
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
      setCameraError(null)
    }
  }, [open, reset, stopCamera])

  const handleRunTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    reset()
    const result = await runSelfTest()
    setTestResult(result)
    setTesting(false)
  }, [reset, runSelfTest])

  if (!open) return null

  const handleStartSender = () => { reset(); startAsSender() }
  const handleStartScanner = () => { reset(); startAsScanner(); setTimeout(startCamera, 100) }

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
            <div className="localsync__or">—</div>
            <button className="btn btn--text" onClick={handleRunTest} disabled={testing}>
              {testing ? '自测中…' : '自检（本地双 PC）'}
            </button>
          </div>
        )}
        {testResult && (
          <div className="localsync__test-results">
            <p className={testResult.ok ? 'localsync__test-verdict pass' : 'localsync__test-verdict fail'}>
              {testResult.ok ? '✓ 自测通过' : '✗ 自测失败'}
            </p>
            <ul className="localsync__test-steps">
              {testResult.steps.map((s, i) => (
                <li key={i} className={s.ok ? 'step-ok' : 'step-fail'}>
                  <span className="step-icon">{s.ok ? '✓' : '✗'}</span>
                  <span className="step-name">{s.name}</span>
                  <br />
                  <span className="step-detail">{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(state.status === 'generating-offer' || state.status === 'connecting' || state.status === 'syncing') && (
          <div className="localsync__progress">
            <div className="localsync__spinner" />
            <p className="localsync__progress-text">{statusLabels[state.status]}</p>
          </div>
        )}

        {state.status === 'showing-qr' && state.role === 'sender' && qrDataUrl && !senderScanning && (
          <div className="localsync__qr-section">
            <p className="localsync__hint">{statusLabels[state.status]}</p>
            <img src={qrDataUrl} alt="QR Code" className="localsync__qr-image" />
            <div className="localsync__text-fallback">
              <button className="btn btn--text" onClick={() => { stopCamera(); setSenderScanning(true); setTimeout(startCamera, 100); }}>
                扫码接收对方信息
              </button>
            </div>
          </div>
        )}

        {state.status === 'showing-qr' && state.role === 'sender' && senderScanning && (
          <div className="localsync__scan-section">
            <p className="localsync__hint">请扫描对方设备上的二维码</p>
            <div className="localsync__viewport">
              <video ref={videoRef} className="localsync__video" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <button className="btn btn--text" onClick={() => { stopCamera(); setSenderScanning(false); }}>
              返回
            </button>
            {cameraError && <p className="localsync__camera-error">{cameraError}</p>}
          </div>
        )}

        {state.status === 'showing-qr' && state.role === 'scanner' && qrDataUrl && (
          <div className="localsync__qr-section">
            <p className="localsync__hint">{statusLabels[state.status]}</p>
            <img src={qrDataUrl} alt="QR Code" className="localsync__qr-image" />
            <p className="localsync__hint localsync__hint--secondary">请将此二维码展示给发送方扫码</p>
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
              <video ref={videoRef} className="localsync__video" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            {cameraError && <p className="localsync__camera-error">{cameraError}</p>}
          </div>
        )}

        {state.status === 'complete' && (
          <div className="localsync__complete">
            <div className="localsync__checkmark">✓</div>
            <p className="localsync__complete-text">同步完成！</p>
            <p className="localsync__stats">
              {state.stats.sent === state.stats.received
                ? `两端各有 ${state.stats.sent} 条，数据一致`
                : `发送 ${state.stats.sent} 条，接收 ${state.stats.received} 条`}
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
