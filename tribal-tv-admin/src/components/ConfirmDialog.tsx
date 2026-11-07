import { LoaderCircle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={busy ? () => undefined : onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={danger ? 'danger-button' : 'primary-button compact'} type="button" onClick={onConfirm} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={15} /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
