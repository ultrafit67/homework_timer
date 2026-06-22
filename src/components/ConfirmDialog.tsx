interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog__title">{title}</div>
        <div className="dialog__message">{message}</div>
        <div className="dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel}>取消</button>
          <button className="btn btn--primary" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}
