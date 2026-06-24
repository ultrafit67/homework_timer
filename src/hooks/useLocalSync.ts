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

        const answerSdp = pc.localDescription!.sdp
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
