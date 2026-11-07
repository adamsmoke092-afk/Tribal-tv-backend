import { CheckCircle2, CircleAlert, X } from 'lucide-react'

export interface Toast {
  id: number
  kind: 'success' | 'error'
  message: string
}

export type Notify = (kind: Toast['kind'], message: string) => void

export default function ToastHost({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.kind}`} key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {toast.kind === 'success' ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => onDismiss(toast.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
