# Record Edit Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit a record's date, start time, end time, and subject via a modal dialog.

**Architecture:** Add `updateRecord` to the IndexedDB data layer and `useRecords` hook. Add an edit button to `RecordItem`. New `EditRecordDialog` component renders a modal with date/time inputs and subject selector. `RecordsView` manages dialog open state.

**Tech Stack:** React 18, TypeScript, idb (IndexedDB wrapper)

---

### Task 1: Add `updateRecord` to db.ts

**Files:**
- Modify: `src/db.ts`

- [ ] **Step 1: Add `updateRecord` export**

Add after `deleteRecord`:

```typescript
export async function updateRecord(record: HomeworkRecord): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, record)
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build passes clean

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat: add updateRecord to db layer"
```

---

### Task 2: Add `updateRecord` to useRecords hook

**Files:**
- Modify: `src/hooks/useRecords.ts`

- [ ] **Step 1: Add `updateRecord` method**

Update the `UseRecordsReturn` interface — add `updateRecord`:

```typescript
interface UseRecordsReturn {
  // ... existing fields
  updateRecord: (record: HomeworkRecord) => Promise<void>
}
```

Add handler after `handleDelete`:

```typescript
const handleUpdate = useCallback(async (record: HomeworkRecord) => {
  await db.updateRecord(record)
  await refresh()
}, [refresh])
```

Add to return object:

```typescript
return {
  // ... existing returns
  updateRecord: handleUpdate,
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build passes clean

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRecords.ts
git commit -m "feat: add updateRecord to useRecords hook"
```

---

### Task 3: Create EditRecordDialog component

**Files:**
- Create: `src/components/EditRecordDialog.tsx`
- Modify: `src/styles.css` (add dialog styles)

- [ ] **Step 1: Create EditRecordDialog component**

```tsx
import { useState } from 'react'
import { HomeworkRecord, Subject, SUBJECTS } from '../types'

interface EditRecordDialogProps {
  record: HomeworkRecord
  onSave: (record: HomeworkRecord) => Promise<void>
  onCancel: () => void
}

function extractDate(iso: string): string {
  return iso.substring(0, 10)
}

function extractTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function EditRecordDialog({ record, onSave, onCancel }: EditRecordDialogProps) {
  const [date, setDate] = useState(record.date)
  const [startTime, setStartTime] = useState(extractTime(record.startTime))
  const [endTime, setEndTime] = useState(extractTime(record.endTime))
  const [subject, setSubject] = useState<Subject>(record.subject)
  const [saving, setSaving] = useState(false)

  // Compute duration for preview
  const computePreview = (): number => {
    try {
      const start = new Date(`${date}T${startTime}:00`).getTime()
      const end = new Date(`${date}T${endTime}:00`).getTime()
      if (end > start) return Math.round((end - start) / 1000)
    } catch { /* ignore */ }
    return 0
  }

  const previewSeconds = computePreview()

  const formatPreview = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    const parts: string[] = []
    if (h > 0) parts.push(`${h}时`)
    if (m > 0) parts.push(`${m}分`)
    parts.push(`${s}秒`)
    return parts.join('')
  }

  const handleSave = async () => {
    if (!startTime || !endTime) return
    const newStartISO = new Date(`${date}T${startTime}:00`).toISOString()
    const newEndISO = new Date(`${date}T${endTime}:00`).toISOString()
    const durationSeconds = Math.round(
      (new Date(newEndISO).getTime() - new Date(newStartISO).getTime()) / 1000
    )
    if (durationSeconds <= 0) return

    setSaving(true)
    try {
      await onSave({
        ...record,
        subject,
        startTime: newStartISO,
        endTime: newEndISO,
        durationSeconds,
        date,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3 className="dialog__title">编辑记录</h3>

        <div className="dialog__field">
          <label className="dialog__label">科目</label>
          <div className="dialog__subject-group">
            {SUBJECTS.map(s => (
              <button
                key={s}
                className={`subject-btn ${subject === s ? 'subject-btn--active' : ''}`}
                onClick={() => setSubject(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">日期</label>
          <input
            type="date"
            className="dialog__input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">开始时间</label>
          <input
            type="time"
            className="dialog__input"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">结束时间</label>
          <input
            type="time"
            className="dialog__input"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          />
        </div>

        <div className="dialog__preview">
          持续时间：{formatPreview(previewSeconds)}
        </div>

        <div className="dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || previewSeconds <= 0}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add dialog styles to styles.css**

Append before the last closing bracket or at the end of the file:

```css
/* Edit Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.dialog {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.dialog__title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
  text-align: center;
}

.dialog__field {
  margin-bottom: 16px;
}

.dialog__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.dialog__input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.2s;
}

.dialog__input:focus {
  border-color: var(--color-primary);
}

.dialog__subject-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dialog__subject-group .subject-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.dialog__subject-group .subject-btn--active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.dialog__preview {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  padding: 12px 0;
}

.dialog__actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.dialog__actions .btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.dialog__actions .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog__actions .btn--primary {
  background: var(--color-primary);
  color: white;
}

.dialog__actions .btn--secondary {
  background: var(--color-bg);
  color: var(--color-text);
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Build passes clean

- [ ] **Step 4: Commit**

```bash
git add src/components/EditRecordDialog.tsx src/styles.css
git commit -m "feat: add EditRecordDialog component"
```

---

### Task 4: Wire up edit button in RecordItem and RecordsView

**Files:**
- Modify: `src/components/RecordItem.tsx`
- Modify: `src/pages/RecordsView.tsx`

- [ ] **Step 1: Update RecordItem to accept onEdit prop**

Replace `interface RecordItemProps`:

```typescript
interface RecordItemProps {
  record: HomeworkRecord
  onDelete: (id: string) => void
  onEdit: (record: HomeworkRecord) => void
}
```

Update the function signature:

```typescript
export function RecordItem({ record, onDelete, onEdit }: RecordItemProps) {
```

Add edit button next to delete button (before the delete button or replace the delete button area with both):

```tsx
      <button
        className="record-item__edit"
        onClick={() => onEdit(record)}
      >
        ✎
      </button>
      <button
        className="record-item__delete"
        onClick={() => {
          if (confirm('确认删除此记录？')) {
            onDelete(record.id)
          }
        }}
      >
        ✕
      </button>
```

- [ ] **Step 2: Add edit button styles to styles.css**

Add after `.record-item__delete:hover`:

```css
.record-item__edit {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 8px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.record-item__edit:hover {
  opacity: 1;
  color: var(--color-primary);
}
```

- [ ] **Step 3: Update RecordsView to manage dialog state and pass onEdit**

In `RecordsView.tsx`:

Add import:
```typescript
import { useState } from 'react'
import { EditRecordDialog } from '../components/EditRecordDialog'
import { HomeworkRecord } from '../types'
```

Add state after `const [page, setPage] = useState(0)`:
```typescript
const [editingRecord, setEditingRecord] = useState<HomeworkRecord | null>(null)
```

Import `updateRecord` from useRecords:
```typescript
const { records, loading, deleteRecord, filterBySubject, subjectFilter, updateRecord } = useRecords()
```

Update RecordItem to pass `onEdit`:
```tsx
<RecordItem key={r.id} record={r} onDelete={deleteRecord} onEdit={setEditingRecord} />
```

Add dialog before closing `</div>`:
```tsx
{editingRecord && (
  <EditRecordDialog
    record={editingRecord}
    onSave={async (updated) => {
      await updateRecord(updated)
      setEditingRecord(null)
    }}
    onCancel={() => setEditingRecord(null)}
  />
)}
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Build passes clean

- [ ] **Step 5: Commit**

```bash
git add src/components/RecordItem.tsx src/pages/RecordsView.tsx src/styles.css
git commit -m "feat: wire up record edit button and dialog"
```

---

### Task 5: Verify all together

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Exit code 0, no errors

- [ ] **Step 2: LSP diagnostics**

Run diagnostics on modified files: `src/db.ts`, `src/hooks/useRecords.ts`, `src/components/RecordItem.tsx`, `src/components/EditRecordDialog.tsx`, `src/pages/RecordsView.tsx`
Expected: No errors
