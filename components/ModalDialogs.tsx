'use client'

/** Single-action notice (replaces window.alert). */
export function InfoModal({
  message,
  onDismiss,
  title = 'Heads up',
  buttonLabel = 'OK',
}: {
  message: string
  onDismiss: () => void
  title?: string
  buttonLabel?: string
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-labelledby="info-modal-title"
        aria-describedby="info-modal-desc"
        className="bg-white rounded-xl shadow-xl border-2 border-slate-200/80 p-6 max-w-sm w-full animate-[bounce-in_0.3s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <h2
          id="info-modal-title"
          className="text-lg font-bold text-[#333333] mb-2"
        >
          {title}
        </h2>
        <p id="info-modal-desc" className="text-[#333333] text-base mb-6">
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full min-h-[44px] rounded-xl bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover active:scale-[0.98] transition-transform"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

/** Two-action confirm (replaces window.confirm). */
export function ConfirmModal({
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30"
      onClick={onCancel}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Escape' && onCancel()}
      aria-label="Dismiss"
    >
      <div
        className="bg-white rounded-xl shadow-xl border-2 border-slate-200/80 p-6 max-w-sm w-full animate-[bounce-in_0.3s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[#333333] text-base mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-xl border-2 border-slate-200 text-[#333333] font-medium hover:bg-slate-50 active:scale-[0.98] transition-transform"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover active:scale-[0.98] transition-transform"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
