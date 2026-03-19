'use client'

export type ModalVariant = 'info' | 'warning' | 'error' | 'success' | 'question'

const INFO_VARIANT = {
  info: {
    emoji: '💡',
    title: 'Heads up',
    border: 'border-sky-200',
    /** Solid fills so page content never shows through the dialog */
    bg: 'bg-sky-50',
    iconRing: 'bg-sky-100',
  },
  warning: {
    emoji: '⚠️',
    title: 'Hold on',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    iconRing: 'bg-amber-100',
  },
  error: {
    emoji: '🚫',
    title: 'Not allowed',
    border: 'border-red-300',
    bg: 'bg-red-50',
    iconRing: 'bg-red-100',
  },
  success: {
    emoji: '✨',
    title: 'Nice!',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    iconRing: 'bg-emerald-100',
  },
  question: {
    emoji: '🤔',
    title: 'Just checking',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    iconRing: 'bg-violet-100',
  },
} as const

/** Single-action notice (replaces window.alert). */
export function InfoModal({
  message,
  onDismiss,
  title,
  buttonLabel = 'OK',
  variant = 'info',
  emoji,
}: {
  message: string
  onDismiss: () => void
  title?: string
  buttonLabel?: string
  variant?: ModalVariant
  emoji?: string
}) {
  const v = INFO_VARIANT[variant]
  const displayEmoji = emoji ?? v.emoji
  const displayTitle = title ?? v.title

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
        className={`rounded-xl shadow-xl border-2 p-6 max-w-sm w-full animate-[bounce-in_0.3s_ease-out] ${v.border} ${v.bg}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-4 items-start mb-4">
          <div
            className={`text-4xl leading-none shrink-0 rounded-2xl p-3 ${v.iconRing}`}
            aria-hidden
          >
            {displayEmoji}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="info-modal-title"
              className="text-lg font-bold text-[#333333] mb-2"
            >
              {displayTitle}
            </h2>
            <p id="info-modal-desc" className="text-[#333333] text-base">
              {message}
            </p>
          </div>
        </div>
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
  variant = 'question',
  emoji,
  title,
}: {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  variant?: ModalVariant
  emoji?: string
  /** Optional short line above the message */
  title?: string
}) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  const v = INFO_VARIANT[variant]
  const displayEmoji = emoji ?? v.emoji

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
        className={`rounded-xl shadow-xl border-2 p-6 max-w-sm w-full animate-[bounce-in_0.3s_ease-out] ${v.border} ${v.bg}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-4 items-start mb-5">
          <div
            className={`text-4xl leading-none shrink-0 rounded-2xl p-3 ${v.iconRing}`}
            aria-hidden
          >
            {displayEmoji}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            {title && (
              <h2 className="text-lg font-bold text-[#333333] mb-2">{title}</h2>
            )}
            <p className="text-[#333333] text-base font-medium leading-snug">
              {message}
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-xl border-2 border-slate-200 bg-white text-[#333333] font-medium hover:bg-slate-50 active:scale-[0.98] transition-transform"
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
