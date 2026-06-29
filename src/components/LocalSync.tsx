import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { useLocalSync, SyncStatus, SelfTestResult, isChunkedPayload, parseChunkHeader, reconstructFromChunks } from '../hooks/useLocalSync'
import { patchConsole, getCapturedLogs, clearCapturedLogs } from '../utils/consoleCapture'
// Activate console capture early
patchConsole()

interface LocalSyncProps {
  open: boolean
  onClose: () => void
}

const SCAN_INTERVAL_MS = 200

export function LocalSync({ open, onClose }: LocalSyncProps) {
  const { state, startAsSender, startAsScanner, setRemoteSDP, reset, runSelfTest } = useLocalSync()

  const [qrDataUrls, setQrDataUrls] = useState<string[] | null>(null)
  const [testResult, setTestResult] = useState<SelfTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [senderScanning, setSenderScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  /** Scan progress while collecting chunks */
  const [scanProgress, setScanProgress] = useState<{ collected: number; total: number } | null>(null)
  /** Which QR code is currently displayed (sequential display) */
  const [currentQrStep, setCurrentQrStep] = useState(0)
  /** Debug: reconstructed SDP preview */
  const [debugReconstructedSdp, setDebugReconstructedSdp] = useState<string | null>(null)
  const [showDiag, setShowDiag] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Buffer for scanned chunk strings */
  const chunkBufferRef = useRef<string[]>([])
  /** Ref holding the current scan result handler (breaks circular useCallback dep) */
  const scanHandlerRef = useRef<((data: string) => void) | null>(null)
  /** Ref holding startCamera (breaks circular dep in handleScanResult) */
  const startCameraRef = useRef<typeof startCamera | null>(null)
  useEffect(() => {
    if (state.sdpChunks && state.sdpChunks.length > 0 && state.status === 'showing-qr') {
      setCurrentQrStep(0)
      Promise.all(state.sdpChunks.map(chunk =>
        QRCode.toDataURL(chunk, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      )).then(setQrDataUrls).catch(() => setQrDataUrls(null))
    } else {
      setQrDataUrls(null)
    }
  }, [state.sdpChunks, state.status])

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
          scanHandlerRef.current?.(code.data)
        }
      }, SCAN_INTERVAL_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCameraError(msg)
    }
  }, [stopCamera])

  const handleScanResult = useCallback(async (data: string) => {
    const raw = data.trim()
    if (isChunkedPayload(raw)) {
      const header = parseChunkHeader(raw)
      if (!header) { setCameraError('二维码内容无效'); return }

      // Deduplicate by index (sync header parse, no decompression needed)
      const dup = chunkBufferRef.current.some(c => {
        const h = parseChunkHeader(c)
        return h && h.index === header.index
      })
      if (!dup) chunkBufferRef.current.push(raw)

      const collected = chunkBufferRef.current.length
      const total = header.total
      setScanProgress({ collected, total })

      if (collected >= total) {
        // All chunks collected — reconstruct
        const fullSdp = await reconstructFromChunks(chunkBufferRef.current)
        chunkBufferRef.current = []
        setScanProgress(null)
        if (fullSdp) {
          // Store SDP preview for debugging
          const lines = fullSdp.split('\n').filter(l => l.length > 0).map(l => l.replace(/\r$/, ''))
          const numbered = lines.map((l, i) => `${String(i + 1).padStart(2, ' ')}: ${l.replace(/\r/g, '\\r')}`).join('\n')
          const preview = `长度 ${fullSdp.length}，行数 ${lines.length}\n---\n${numbered}\n---`
          setDebugReconstructedSdp(preview)
          setSenderScanning(false)
          setRemoteSDP(fullSdp)
        } else {
          setCameraError('二维码数据重组失败')
        }
      } else {
        // Continue scanning for more chunks
        startCameraRef.current?.()
      }
    } else if (raw.startsWith('v=')) {
      // Legacy single-QR SDP
      chunkBufferRef.current = []
      setScanProgress(null)
      setSenderScanning(false)
      setRemoteSDP(raw)
    } else if (raw.startsWith('!')) {
      setCameraError('二维码格式不完整，请重新扫描')
    } else {
      setCameraError('无法识别的二维码内容')
    }
  }, [setRemoteSDP])

  // Keep refs synchronized to break circular deps
  useEffect(() => { startCameraRef.current = startCamera })
  useEffect(() => { scanHandlerRef.current = handleScanResult })

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!open) {
      stopCamera()
      reset()
      setQrDataUrls(null)
      setCameraError(null)
      setScanProgress(null)
      chunkBufferRef.current = []
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

  const clearScanBuffer = () => {
    chunkBufferRef.current = []
    setScanProgress(null)
    setDebugReconstructedSdp(null)
    setShowDiag(false)
  }
  const handleStartSender = () => { clearScanBuffer(); reset(); startAsSender() }
  const handleStartScanner = () => { clearScanBuffer(); reset(); startAsScanner(); setTimeout(startCamera, 100) }

  const statusLabels: Record<SyncStatus, string> = {
    idle: '',
    'generating-offer': '正在准备连接…',
    'showing-qr': state.role === 'sender' ? '请对方扫描二维码' : '请扫描对方设备上的二维码',
    scanning: '正在扫描二维码…',
    connecting: '正在建立连接…',
    syncing: '正在同步数据…',
    complete: '',
    error: ''
  }

  const chunkCount = state.sdpChunks?.length ?? 0

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
                  <span className="step-detail">{s.detail}</span>
                </li>
              ))}
            </ul>
            <button className="btn btn--text" onClick={() => setTestResult(null)} style={{ marginTop: 8 }}>
              返回
            </button>
          </div>
        )}

        {(state.status === 'generating-offer' || state.status === 'connecting' || state.status === 'syncing') && (
          <div className="localsync__progress">
            <div className="localsync__spinner" />
            <p className="localsync__progress-text">{statusLabels[state.status]}</p>
          </div>
        )}

        {/* Sender showing QR codes one at a time */}
        {state.status === 'showing-qr' && state.role === 'sender' && qrDataUrls && qrDataUrls.length > 0 && !senderScanning && (
          <div className="localsync__qr-section">
            <p className="localsync__hint">
              请对方扫描第 {currentQrStep + 1} 个二维码（共 {chunkCount} 个）
            </p>
            <img src={qrDataUrls[currentQrStep]} alt={`二维码 ${currentQrStep + 1}`} className="localsync__qr-image" />
            <div className="localsync__qr-nav">
              {currentQrStep < chunkCount - 1 ? (
                <button className="btn btn--primary" onClick={() => setCurrentQrStep(s => s + 1)}>
                  已扫描，下一个 ({currentQrStep + 1}/{chunkCount})
                </button>
              ) : (
                <span className="localsync__qr-done">所有二维码已展示 ✓</span>
              )}
            </div>
            <div className="localsync__text-fallback">
              <button className="btn btn--text" onClick={() => { stopCamera(); chunkBufferRef.current = []; setScanProgress(null); setSenderScanning(true); setTimeout(startCamera, 100); }}>
                扫码接收对方信息
              </button>
            </div>
          </div>
        )}

        {/* Sender scanning answer QRs */}
        {state.status === 'showing-qr' && state.role === 'sender' && senderScanning && (
          <div className="localsync__scan-section">
            {scanProgress ? (
              <p className="localsync__hint">已扫码 {scanProgress.collected}/{scanProgress.total}，继续扫描…</p>
            ) : (
              <p className="localsync__hint">请扫描对方设备上的二维码</p>
            )}
            <div className="localsync__viewport">
              <video ref={videoRef} className="localsync__video" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <button className="btn btn--text" onClick={() => { stopCamera(); chunkBufferRef.current = []; setScanProgress(null); setSenderScanning(false); }}>
              返回
            </button>
            {cameraError && <p className="localsync__camera-error">{cameraError}</p>}
          </div>
        )}

        {/* Scanner showing answer QR codes one at a time */}
        {state.status === 'showing-qr' && state.role === 'scanner' && qrDataUrls && qrDataUrls.length > 0 && (
          <div className="localsync__qr-section">
            <p className="localsync__hint">
              请发送方扫描第 {currentQrStep + 1} 个二维码（共 {chunkCount} 个）
            </p>
            <img src={qrDataUrls[currentQrStep]} alt={`二维码 ${currentQrStep + 1}`} className="localsync__qr-image" />
            <div className="localsync__qr-nav">
              {currentQrStep < chunkCount - 1 ? (
                <button className="btn btn--primary" onClick={() => setCurrentQrStep(s => s + 1)}>
                  已扫描，下一个 ({currentQrStep + 1}/{chunkCount})
                </button>
              ) : (
                <span className="localsync__qr-done">所有二维码已展示 ✓</span>
              )}
            </div>
          </div>
        )}

        {state.status === 'showing-qr' && !qrDataUrls && !senderScanning && (
          <div className="localsync__progress">
            <div className="localsync__spinner" />
            <p>正在生成二维码…</p>
          </div>
        )}

        {/* Scanner scanning offer QRs with progress */}
        {state.status === 'scanning' && (
          <div className="localsync__scan-section">
            {scanProgress ? (
              <p className="localsync__hint">已扫码 {scanProgress.collected}/{scanProgress.total}，继续扫描…</p>
            ) : (
              <p className="localsync__hint">{statusLabels[state.status]}</p>
            )}
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
            {debugReconstructedSdp && (
              <div className="localsync__debug">
                <button className="btn btn--text" style={{ fontSize: 10, padding: '2px 6px', float: 'right' }} onClick={() => navigator.clipboard.writeText(debugReconstructedSdp)}>复制</button>
                <pre style={{ fontSize: 10, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', clear: 'both' }}>{debugReconstructedSdp}</pre>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn--text" style={{ fontSize: 11 }} onClick={() => setShowDiag(v => !v)}>
                {showDiag ? '隐藏' : '显示'}诊断日志
              </button>
              {showDiag && (
                <pre style={{ fontSize: 10, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4 }}>{getCapturedLogs() || '(无日志)'}</pre>
              )}
            </div>
            <button className="btn btn--primary" onClick={() => { clearScanBuffer(); reset(); clearCapturedLogs() }}>重试</button>
          </div>
        )}

        <div className="dialog__actions">
          {(state.status === 'complete' || state.status === 'error') && (
            <button className="btn btn--secondary btn--large" onClick={onClose}>关闭</button>
          )}
          {state.status !== 'idle' && state.status !== 'complete' && state.status !== 'error' && (
            <button className="btn btn--secondary btn--large" onClick={() => { stopCamera(); clearScanBuffer(); reset(); }}>取消</button>
          )}
        </div>
      </div>
    </div>
  )
}
