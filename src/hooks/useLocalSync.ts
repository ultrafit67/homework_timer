import { useCallback, useRef, useState } from 'react'
import { getAllRecords, upsertRecords } from '../db'
import { HomeworkRecord, USERS } from '../types'
import { saveUserName, saveGrade, loadUserNames, loadGrade } from '../utils'

/** Marker prefix for chunked QR payloads */
export const QR_PREFIX = '!qr|'

/** Encode a chunk of SDP into a scannable string */
function encodeChunk(sessionId: string, total: number, index: number, data: string): string {
  const encoded = btoa(unescape(encodeURIComponent(data)))
  return `${QR_PREFIX}${sessionId}|${total}|${index}|${encoded}`
}

/** Decode a chunk string back to its parts, or null if invalid */
export function decodeChunk(payload: string): { sessionId: string; total: number; index: number; data: string } | null {
  const prefixIndex = payload.indexOf(QR_PREFIX)
  if (prefixIndex === -1) return null
  let pos = prefixIndex + QR_PREFIX.length
  const sep1 = payload.indexOf('|', pos); if (sep1 === -1) return null
  const sessionId = payload.slice(pos, sep1); pos = sep1 + 1
  const sep2 = payload.indexOf('|', pos); if (sep2 === -1) return null
  const total = parseInt(payload.slice(pos, sep2), 10); if (isNaN(total)) return null; pos = sep2 + 1
  const sep3 = payload.indexOf('|', pos); if (sep3 === -1) return null
  const index = parseInt(payload.slice(pos, sep3), 10); if (isNaN(index)) return null; pos = sep3 + 1
  const data = decodeURIComponent(escape(atob(payload.slice(pos))))
  return { sessionId, total, index, data }
}

/** Check whether a scanned payload is a chunked payload */
export function isChunkedPayload(data: string): boolean {
  return data.trim().startsWith(QR_PREFIX)
}

/** Strip chunk prefix/formatting — useful when QR decode adds whitespace */
export function stripChunkPrefix(data: string): string {
  return data.trim()
}

/** Split an SDP string into N chunk-encoded strings */
export function splitSdpIntoChunks(sdp: string, total: number = 3): string[] {
  const sessionId = Math.random().toString(36).slice(2, 6)
  const chunkSize = Math.ceil(sdp.length / total)
  const chunks: string[] = []
  for (let i = 0; i < total; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, sdp.length)
    chunks.push(encodeChunk(sessionId, total, i, sdp.slice(start, end)))
  }
  return chunks
}

/** Reconstruct a full SDP from collected chunk strings, or null if incomplete/mismatched */
export function reconstructFromChunks(chunks: string[]): string | null {
  if (chunks.length === 0) return null
  const parts = chunks.map(c => decodeChunk(c))
  if (parts.some(p => p === null)) return null
  const valid = parts as NonNullable<typeof parts[0]>[]
  const { sessionId, total } = valid[0]
  if (valid.some(p => p.sessionId !== sessionId || p.total !== total)) return null
  valid.sort((a, b) => a.index - b.index)
  return valid.map(p => p.data).join('')
}

/** A single self-test step log entry */
export interface TestStep {
  name: string
  ok: boolean
  detail: string
}

/** Self-test result summary */
export interface SelfTestResult {
  ok: boolean
  steps: TestStep[]
}

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
  sdpChunks: string[] | null
  stats: { sent: number; received: number }
  error: string | null
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

const CONNECTION_TIMEOUT_MS = 30_000

function cleanSDP(raw: string): string {
  const seenIpv4Host = new Set<string>()
  let seenSrflx = false

  const dropLine = (line: string) =>
    line.startsWith('a=sctp-port') ||
    line.startsWith('a=extmap-allow-mixed') ||
    line.startsWith('a=msid-semantic') ||
    line.startsWith('a=ice-options:trickle')

  const stripCandidateExtras = (line: string) =>
    line.replace(/ generation \d+/g, '').replace(/ network-cost \d+/g, '')

  const isCandidate = (line: string) => line.startsWith('a=candidate:')
  const parts = (line: string) => line.split(' ')
  const transport = (p: string[]) => p[2].toLowerCase()
  const address = (p: string[]) => p[4]
  const candType = (p: string[]) => p[6]

  return raw
    .split('\n')
    .filter(l => !dropLine(l))
    .map(l => isCandidate(l) ? stripCandidateExtras(l) : l)
    .filter(l => {
      if (!isCandidate(l)) return true
      const p = parts(l)
      if (p.length < 8) return true
      if (transport(p) === 'tcp' || address(p).includes(':')) return false

      if (candType(p) === 'host') {
        if (seenIpv4Host.has(address(p))) return false
        seenIpv4Host.add(address(p))
        return true
      }

      if (candType(p) === 'srflx') {
        if (seenSrflx) return false
        seenSrflx = true
        return true
      }

      return true
    })
    .join('\n')
}

interface SyncPayload {
  type: 'records'
  records: HomeworkRecord[]
  userNames?: [string, string]
  userGrades?: [number, number]
}

function buildPayload(records: HomeworkRecord[], names: string[], grades: number[]): string {
  const payload: SyncPayload = {
    type: 'records',
    records,
    userNames: [names[0], names[1]],
    userGrades: [grades[0], grades[1]]
  }
  return JSON.stringify(payload)
}

function mergeUserConfig(payload: SyncPayload) {
  const { userNames: remoteNames, userGrades: remoteGrades } = payload
  if (!remoteNames && !remoteGrades) return
  const localNames = loadUserNames()
  if (remoteNames) {
    for (let i = 0; i < 2; i++) {
      if (localNames[i] === USERS[i] && remoteNames[i] !== USERS[i]) {
        saveUserName(i, remoteNames[i])
      }
    }
  }
  if (remoteGrades) {
    for (let i = 0; i < 2; i++) {
      const localGrade = loadGrade(i)
      if (localGrade === 0 && remoteGrades[i] !== 0) {
        saveGrade(i, remoteGrades[i])
      }
    }
  }
}

export function useLocalSync() {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    role: null,
    sdp: null,
    sdpChunks: null,
    stats: { sent: 0, received: 0 },
    error: null
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exchangedRef = useRef(false)
  /** Buffer for data channel messages that arrive before we're ready to process them */
  const msgBufferRef = useRef<string[]>([])

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

    const waitForMessage = (timeoutMs: number) => new Promise<SyncPayload>((resolve, reject) => {
      // Check buffer first — message may have arrived before exchangeRecords set up
      while (msgBufferRef.current.length > 0) {
        try {
          const data = JSON.parse(msgBufferRef.current.shift()!)
          if (data.type === 'records') return resolve(data as SyncPayload)
        } catch { /* ignore malformed */ }
      }

      const timer = setTimeout(() => {
        dc.onmessage = null
        reject(new Error('同步超时：未收到对方数据'))
      }, timeoutMs)

      dc.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string)
          if (data.type === 'records') {
            clearTimeout(timer)
            dc.onmessage = null
            resolve(data as SyncPayload)
          }
        } catch { /* ignore malformed */ }
      }
    })

    try {
      const names = loadUserNames()
      const grades = [loadGrade(0), loadGrade(1)]

      if (role === 'sender') {
        const payload = buildPayload(localRecords, names, grades)
        dc.send(payload)
        const remote = await waitForMessage(15_000)
        await upsertRecords(remote.records)
        mergeUserConfig(remote)
        updateStatus({ status: 'complete', stats: { sent: localCount, received: remote.records.length } })
      } else {
        const remote = await waitForMessage(15_000)
        await upsertRecords(remote.records)
        mergeUserConfig(remote)
        dc.send(buildPayload(localRecords, names, grades))
        updateStatus({ status: 'complete', stats: { sent: localCount, received: remote.records.length } })
      }
    } catch (e) {
      handleError(e instanceof Error ? e.message : '数据交换失败')
    }
  }, [updateStatus, handleError])

  const setupDataChannel = useCallback((dc: RTCDataChannel, role: 'sender' | 'scanner') => {
    msgBufferRef.current = []

    // Persistent onmessage: buffer everything so messages are never lost
    dc.onmessage = (e: MessageEvent) => {
      msgBufferRef.current.push(e.data as string)
    }

    const startExchange = () => {
      if (exchangedRef.current) return
      exchangedRef.current = true
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      exchangeRecords(dc, role).catch(e => handleError(e.message))
    }
    dc.onopen = startExchange
    if (dc.readyState === 'open') startExchange()
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

      updateStatus({ status: 'showing-qr', sdpChunks: splitSdpIntoChunks(cleanSDP(sdp), 4) })

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

  const setRemoteSDP = useCallback(async (rawSdp: string) => {
    const pc = pcRef.current
    if (!pc) { handleError('连接未初始化'); return }

    // Log byte-level details to check for \r presence
    const previewBytes = Array.from(rawSdp.slice(0, 80)).map(c => `${c.charCodeAt(0)}`).join(',')
    console.log('[setRemoteSDP] rawSdp charCodes(80):', previewBytes)
    console.log('[setRemoteSDP] rawSdp includes \\r:', rawSdp.includes('\r'), 'includes \\n:', rawSdp.includes('\n'))
    // Check last 10 chars for trailing garbage
    const tail = rawSdp.slice(-10)
    const tailCodes = Array.from(tail).map(c => `${c.charCodeAt(0)}`).join(',')
    console.log('[setRemoteSDP] rawSdp 尾部10字符:', JSON.stringify(tail), 'charCodes:', tailCodes)

    const sdp = cleanSDP(rawSdp)
    console.log('[setRemoteSDP] pc.localDescription=%s, sdp.length=%d, cleanSDP后长度=%d', pc.localDescription ? '存在' : 'null', rawSdp.length, sdp.length)
    console.log('[setRemoteSDP] sdp带行号:\n' + sdp.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'))

    try {
      // Pre-test: validate SDP on a temporary PC before using real one
      const testPc = new RTCPeerConnection(RTC_CONFIG)
      try {
        await testPc.setRemoteDescription({ type: 'offer', sdp })
        console.log('[setRemoteSDP] SDP预测试: 临时PC接受成功')
        testPc.close()
      } catch (testErr) {
        const testMsg = testErr instanceof Error ? testErr.message : String(testErr)
        console.error('[setRemoteSDP] SDP预测试: 临时PC也拒绝:', testMsg)
        testPc.close()
        throw new Error('SDP 解析失败（临时PC也拒绝）: ' + testMsg)
      }

      if (!pc.localDescription) {
        // Scanner receiving the Offer from QR
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        await pc.setRemoteDescription({ type: 'offer', sdp })
        console.log('[setRemoteSDP] setRemoteDescription(offer) 成功')
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log('[setRemoteSDP] createAnswer + setLocalDescription 成功')

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') { resolve(); return }
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve()
          }
          setTimeout(resolve, 2000)
        })

        const answerSdp = pc.localDescription!.sdp
        if (answerSdp) {
          updateStatus({ status: 'showing-qr', sdpChunks: splitSdpIntoChunks(cleanSDP(answerSdp), 4) })
        }
      } else {
        // Sender receiving the Answer from QR
        console.log('[setRemoteSDP] 设置 answer')
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        await pc.setRemoteDescription({ type: 'answer', sdp })
        console.log('[setRemoteSDP] setRemoteDescription(answer) 成功')
        updateStatus({ status: 'connecting' })
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'SDP 交换失败'
      const lineInfo = e && typeof e === 'object' && 'sdpLineNumber' in e ? ` (行 ${(e as any).sdpLineNumber})` : ''
      const errProps = typeof e === 'object' && e !== null
        ? ['message', 'name', 'errorDetail', 'sdpLineNumber', 'sdpLineNumber', 'code']
            .map(f => `${f}=${(e as any)[f]}`)
            .filter(s => !s.endsWith('=undefined'))
            .join(', ')
        : String(e)
      console.error('[setRemoteSDP] 失败详情:', errProps)
      handleError(errMsg + lineInfo)
    }
  }, [handleError, updateStatus])

  const reset = useCallback(() => {
    cleanup()
    exchangedRef.current = false
    msgBufferRef.current = []
    updateStatus({
      status: 'idle', role: null, sdp: null, sdpChunks: null,
      stats: { sent: 0, received: 0 }, error: null
    })
  }, [cleanup, updateStatus])

  /** Run a self-test in the same page: two PCs exchange cleaned SDP + data */
  const runSelfTest = useCallback(async (): Promise<SelfTestResult> => {
    const steps: TestStep[] = []
    let ok = true

    const add = (name: string, stepOk: boolean, detail: string) => {
      steps.push({ name, ok: stepOk, detail })
      if (!stepOk) ok = false
    }

    // --- PC1 (sender): create data channel, offer, local desc ---
    let pc1: RTCPeerConnection | null = null
    let pc2: RTCPeerConnection | null = null

    try {
      pc1 = new RTCPeerConnection(RTC_CONFIG)
      const dc1 = pc1.createDataChannel('test-sync')

      const dcOpened = new Promise<void>((resolve) => { dc1.onopen = () => resolve() })
      const offer = await pc1.createOffer()
      await pc1.setLocalDescription(offer)
      await new Promise<void>((resolve) => {
        if (pc1!.iceGatheringState === 'complete') { resolve(); return }
        pc1!.onicegatheringstatechange = () => { if (pc1!.iceGatheringState === 'complete') resolve() }
        setTimeout(resolve, 2000)
      })
      const rawOfferSdp = pc1.localDescription?.sdp ?? ''
      add('PC1 创建 Offer', !!rawOfferSdp, rawOfferSdp ? `长度 ${rawOfferSdp.length}` : 'SDP 为空')

      const rawPreview = rawOfferSdp.slice(0, 80).split('').map(c => {
        const code = c.charCodeAt(0)
        return code < 32 || code > 126 ? `\\x${code.toString(16).padStart(2, '0')}` : c
      }).join('')
      add('原始 SDP 前 80 字符', true, rawPreview)

      const cleanedOfferSdp = cleanSDP(rawOfferSdp)
      add('cleanSDP 后', true, `长度 ${rawOfferSdp.length}→${cleanedOfferSdp.length}`)

      // Test 1: try RAW SDP on a fresh PC2
      const pc2raw = new RTCPeerConnection(RTC_CONFIG)
      try {
        await pc2raw.setRemoteDescription({ type: 'offer', sdp: rawOfferSdp })
        add('PC2 setRemoteDescription(原始 SDP)', true, '原始 SDP 可被接受')
        pc2raw.close()
      } catch (e: unknown) {
        add('PC2 setRemoteDescription(原始 SDP)', false, e instanceof Error ? e.message : String(e))
        pc2raw.close()
        // If raw SDP also fails, the issue is not cleanSDP - re-throw
        throw new Error('原始 SDP 也被拒绝，浏览器无法解析自己的 SDP')
      }

      // Test 2: try cleaned SDP
      pc2 = new RTCPeerConnection(RTC_CONFIG)
      let dc2Received: RTCDataChannel | null = null
      const dc2Ready = new Promise<void>((resolve) => {
        pc2!.ondatachannel = (ev) => { dc2Received = ev.channel; resolve() }
      })

      try {
        await pc2.setRemoteDescription({ type: 'offer', sdp: cleanedOfferSdp })
        add('PC2 setRemoteDescription(清洗后 SDP)', true, '成功')
      } catch (e: unknown) {
        add('PC2 setRemoteDescription(清洗后 SDP)', false, e instanceof Error ? e.message : String(e))
        throw e
      }

      // --- PC2: create answer, local desc ---
      const answer = await pc2.createAnswer()
      await pc2.setLocalDescription(answer)
      await new Promise<void>((resolve) => {
        if (pc2!.iceGatheringState === 'complete') { resolve(); return }
        pc2!.onicegatheringstatechange = () => { if (pc2!.iceGatheringState === 'complete') resolve() }
        setTimeout(resolve, 2000)
      })
      const rawAnswerSdp = pc2.localDescription?.sdp ?? ''
      add('PC2 创建 Answer', !!rawAnswerSdp, rawAnswerSdp ? `长度 ${rawAnswerSdp.length}` : 'SDP 为空')

      const cleanedAnswerSdp = cleanSDP(rawAnswerSdp)

      // --- PC1: receive answer via setRemoteDescription ---
      try {
        await pc1.setRemoteDescription({ type: 'answer', sdp: cleanedAnswerSdp })
        add('PC1 setRemoteDescription(answer)', true, '成功')
      } catch (e: unknown) {
        add('PC1 setRemoteDescription(answer)', false, e instanceof Error ? e.message : String(e))
        throw e
      }

      // --- Wait for data channel on PC2 ---
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('ondatachannel 超时')), 5000)
        dc2Ready.then(() => { clearTimeout(timer); resolve() })
      })
      add('PC2 ondatachannel 触发', !!dc2Received, dc2Received ? '收到数据通道事件' : '未触发')

      // --- Wait for data channel to open on PC1 ---
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('数据通道打开超时')), 5000)
        dcOpened.then(() => { clearTimeout(timer); resolve() })
      })
      add('PC1 数据通道打开', true, 'dc.onopen 触发')

      // --- Exchange test data ---
      const msgFromPc2 = new Promise<string>((resolve) => {
        if (!dc2Received) { resolve('无数据通道'); return }
        dc2Received.onmessage = (e) => resolve(e.data as string)
      })
      dc1.send(JSON.stringify({ test: 'hello from PC1' }))
      const received = await msgFromPc2
      add('PC1 → PC2 数据收发', received.includes('hello from PC1'), `PC2 收到: ${received}`)

      const msgFromPc1 = new Promise<string>((resolve) => {
        dc1.onmessage = (e) => resolve(e.data as string)
      })
      dc2Received!.send(JSON.stringify({ test: 'hello from PC2' }))
      const received2 = await msgFromPc1
      add('PC2 → PC1 数据收发', received2.includes('hello from PC2'), `PC1 收到: ${received2}`)

      // --- Chunk encode/decode/reconstruct test ---
      try {
        for (const total of [1, 2, 3, 4, 5, 10]) {
          const chunks = splitSdpIntoChunks(cleanedOfferSdp, total)
          const reconstructed = reconstructFromChunks(chunks)
          const match = reconstructed === cleanedOfferSdp
          add(`分块测试 total=${total}`, match,
            match ? `长度 ${cleanedOfferSdp.length}，${total} 块` : `不匹配: 原始长度 ${cleanedOfferSdp.length}，重建长度 ${reconstructed?.length ?? 0}`)
          if (!match) throw new Error(`分块 total=${total} 重建结果不一致`)
        }
      } catch (e: unknown) {
        add('⚠ 分块测试异常', false, e instanceof Error ? e.message : String(e))
      }

    } catch (e: unknown) {
      add('⚠ 自测异常', false, e instanceof Error ? e.message : String(e))
    } finally {
      pc1?.close()
      pc2?.close()
    }

    return { ok, steps }
  }, [])

  return { state, startAsSender, startAsScanner, setRemoteSDP, reset, runSelfTest }
}
