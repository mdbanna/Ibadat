import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** Built on the native <dialog>: focus trapping, Esc to close and inert background come from the browser. */
export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className={`m-auto ${wide ? 'w-[min(56rem,calc(100%-1.5rem))]' : 'w-[min(32rem,calc(100%-2rem))]'} max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-(--radius-card) border border-line bg-surface p-0 text-ink shadow-(--shadow-overlay) backdrop:bg-ink/50`}
    >
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-(length:--text-h3) font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="-m-2 grid size-11 place-items-center rounded-lg text-muted hover:bg-forest-soft hover:text-forest">
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  )
}
