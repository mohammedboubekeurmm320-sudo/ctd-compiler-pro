// ============================================================
// ToastContainer — notifications visuelles globales
// ============================================================

import { useNotificationStore } from '@/stores/documentStore'
import { clsx } from 'clsx'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm',
            'animate-in slide-in-from-right-4 duration-200',
            toast.type === 'success' && 'bg-success-50 border-success-200 text-success-800',
            toast.type === 'error'   && 'bg-danger-50 border-danger-200 text-danger-800',
            toast.type === 'warning' && 'bg-warning-50 border-warning-200 text-warning-800',
            toast.type === 'info'    && 'bg-blue-50 border-blue-200 text-blue-800',
          )}
        >
          <span className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle2 size={16} />}
            {toast.type === 'error'   && <XCircle size={16} />}
            {toast.type === 'warning' && <AlertTriangle size={16} />}
            {toast.type === 'info'    && <Info size={16} />}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
