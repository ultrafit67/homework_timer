# LocalSync: LAN Device-to-Device Sync

**Date**: 2026-06-24
**Status**: Draft

## Overview

Peer-to-peer data sync between two devices on the same WiFi network, without cloud dependency. Uses WebRTC DataChannel for direct device-to-device communication and QR codes for signaling handshake.

## Sync Flow (双 QR 握手)

```
Device A (Sender)                Device B (Receiver)
─────────────────                ────────────────────
点「显示二维码」                                   
↓                                                
创建 WebRTC Offer                                
显示 Offer QR ────扫码────→  扫 A 的二维码         
                              ↓                  
                             创建 WebRTC Answer    
                              ↓                  
                             显示 Answer QR       
←───扫码────  扫 B 的二维码                        
↓                               ↓                
═══ WebRTC DataChannel ════════                   
↓                               ↓                
发送所有本地记录 ──────→   接收并 upsert 到 DB     
↓                               ↓                
接收并 upsert ←──────    发送自己的所有本地记录     
↓                               ↓                
完成！                          完成！             
发送 N 条，接收 M 条          发送 M 条，接收 N 条
```

## Data Protocol

After WebRTC DataChannel connects, data exchange happens in order:

1. **A → B**: `{ type: "records", records: HomeworkRecord[] }` — A's full record set
2. **B** receives → calls `upsertRecords()` to merge A's records into IndexedDB
3. **B → A**: `{ type: "records", records: HomeworkRecord[] }` — B's full record set
4. **A** receives → calls `upsertRecords()` to merge B's records

**Conflict resolution**: upsert by record ID (same as existing `db.ts:upsertRecords`). Since record IDs are UUIDs, same-ID conflicts are extremely rare. For the same ID, the later write wins on each device — both devices end up with a union of all records.

**Data scope**: All non-deleted records (`getAllRecords()`) are exchanged. Deleted records are handled via the `deleted: true` flag — if device A has a record with `deleted: true` and device B doesn't have it, upsert will add the deleted record to B (which will be filtered out of UI). This preserves the deletion state.

## Component Architecture

### `src/hooks/useLocalSync.ts` — WebRTC + state machine

**State machine**:

| Status | Meaning |
|---|---|
| `idle` | Not started |
| `generating-offer` | Creating WebRTC Offer |
| `showing-qr` | Displaying QR with Offer, waiting for scan |
| `scanning` | Camera open, waiting to scan a QR |
| `connecting` | SDP exchanged, ICE connecting |
| `syncing` | DataChannel established, transferring records |
| `complete` | Sync finished successfully |
| `error` | Error occurred (with message) |

**Exports**:

```typescript
interface LocalSyncState {
  status: SyncStatus
  sdp: string | null          // SDP to encode as QR
  stats: { sent: number; received: number }
  error: string | null
}

interface UseLocalSyncReturn {
  state: LocalSyncState
  startAsSender: () => Promise<void>   // Generate Offer, show QR
  startAsScanner: () => Promise<void>  // Open camera, scan QR
  setRemoteSDP: (sdp: string) => void  // Set remote Answer (scanned QR)
  reset: () => void
}
```

**WebRTC config**:

```typescript
const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}
```

No TURN needed — both devices on same LAN, STUN is sufficient.

### `src/components/LocalSync.tsx` — UI Component

**Role-switching entry**:
- Two large buttons on idle: 「显示二维码(发送方)」「扫码同步(接收方)」

**Views by state**:

| State | UI |
|---|---|
| `idle` | Two mode-select buttons |
| `generating-offer` | Loading spinner + "正在准备…" |
| `showing-qr` | Large QR code + instruction text + "备选：复制 Offer 文字" link |
| `scanning` | Camera viewfinder + cancel button + "备选：粘贴 Answer 文字" link |
| `connecting` | Loading spinner + "正在建立连接…" |
| `syncing` | Progress text + "正在同步数据…" |
| `complete` | ✓ icon + "同步完成！发送 N 条，接收 M 条" + 关闭按钮 |
| `error` | Error message + 重试/关闭 |

**Text fallback**: Each QR state includes a "复制/粘贴" link for devices without camera access.

**Dialog vs Page**: Rendered as a modal dialog overlay (consistent with existing `ConfirmDialog`, `EditRecordDialog`, `SyncSettings` patterns).

### Integration in `src/App.tsx`

Add a sync button in the bottom nav area or as a floating button. Simpler approach: add a "本地同步" option to the existing sync indicator floating pill. Clicking it opens the LocalSync dialog.

Alternatively, add a small icon button in the bottom nav bar alongside the existing 3 tabs.

## Required npm Packages

- `qrcode` — QR code generation (render to canvas) — `npm install qrcode`
- `jsQR` — QR code decoding from camera stream — `npm install jsQR`
- Types: `@types/qrcode` — `npm install -D @types/qrcode`

## Files to Create

| File | Purpose |
|---|---|
| `src/hooks/useLocalSync.ts` | WebRTC connection + sync logic |
| `src/components/LocalSync.tsx` | UI component for sync interaction |

## Files to Modify

| File | Changes |
|---|---|
| `src/App.tsx` | Import and render LocalSync dialog, add trigger |
| `src/styles.css` | Add LocalSync styles (QR display, camera viewfinder, progress) |

## Error Handling

- **QR scan failure**: Wrong QR or corrupted data → show error, allow retry
- **WebRTC connection timeout**: 30s timeout → show "连接超时，请重试"
- **DataChannel disconnect mid-transfer**: Show partial results + "连接断开"
- **Camera permission denied**: Show "需要相机权限" + guide to text fallback
- **No camera available**: Auto-detect, show text fallback directly

## Non-Goals

- Real-time sync (one-time sync only)
- Auto-discovery of devices on LAN
- Cloud relay or TURN server
- Sync of localStorage settings (user names, grades — device-specific)
- Merge conflict UI (simple upsert is sufficient for this app's usage)

## Future Considerations

- If same-ID conflicts become an issue, add `updatedAt` field to `HomeworkRecord` and update `upsertRecords` to compare timestamps
- If LAN sync is used heavily, consider adding a connection progress indicator with ICE candidate status
