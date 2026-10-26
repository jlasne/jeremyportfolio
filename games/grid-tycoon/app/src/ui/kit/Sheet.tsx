// Surfaces: Panel (a titled card inside a sheet or a screen), Sheet (the panel dock's side / bottom
// sheet), and Dialog (a native modal <dialog>, which brings its own focus trap and Esc).

import { forwardRef, useEffect, useRef } from 'react'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { IconButton } from './Button'
import type { IconName } from './icons'
import { Icon } from './icons'

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  icon?: IconName
  /** Right side of the header (a value, a button). */
  aside?: ReactNode
  tone?: 'plain' | 'sunken' | 'plant' | 'grid' | 'dc' | 'town' | 'money' | 'power'
  children?: ReactNode
}

export function Panel({ title, icon, aside, tone = 'plain', className, children, ...rest }: PanelProps) {
  return (
    <section className={`panel panel-${tone}${className ? ` ${className}` : ''}`} {...rest}>
      {title != null || aside != null ? (
        <header className="panel-head">
          {title != null ? (
            <h3 className="panel-title">
              {icon ? <Icon name={icon} size={16} /> : null}
              {title}
            </h3>
          ) : (
            <span />
          )}
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  )
}

interface SheetProps extends HTMLAttributes<HTMLElement> {
  title: string
  icon?: IconName
  onClose: () => void
  /** Hides the close button (e.g. the forced sale cannot be dismissed). */
  locked?: boolean
  headingRef?: Ref<HTMLHeadingElement>
  children?: ReactNode
}

export const Sheet = forwardRef<HTMLElement, SheetProps>(function Sheet({ title, icon, onClose, locked, headingRef, className, children, ...rest }, ref) {
  return (
    <section ref={ref} className={`sheet${className ? ` ${className}` : ''}`} {...rest}>
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2 className="sheet-title" tabIndex={-1} ref={headingRef}>
          {icon ? <Icon name={icon} size={24} /> : null}
          {title}
        </h2>
        {locked ? null : <IconButton icon="close" label={`Close ${title}`} onClick={onClose} size="sm" />}
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  )
})

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  icon?: IconName
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, icon, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    } else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog${className ? ` ${className}` : ''}`}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open ? (
        <div className="dialog-card">
          <header className="dialog-head">
            <h2 id="dialog-title" className="dialog-title">
              {icon ? <Icon name={icon} size={24} /> : null}
              {title}
            </h2>
            <IconButton icon="close" label="Close" onClick={onClose} size="sm" />
          </header>
          <div className="dialog-body">{children}</div>
          {footer ? <footer className="dialog-foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  )
}
