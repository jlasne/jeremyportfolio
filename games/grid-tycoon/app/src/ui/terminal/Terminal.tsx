// A terminal: a full-screen view over the map area (under the top bar and chips, beside the rail)
// for the decisions that need room: Allocate and Market. Its own header has a back button, the
// title (focusable, focus lands there on open) and a short subtitle. Esc and the back button close
// it; the dock moves focus back to the rail tab.

import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { Button, Icon } from '../kit'
import type { IconName } from '../kit'
import './terminal.css'

interface TerminalProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string
  icon: IconName
  /** One line under the title (round, what the terminal is for). */
  sub?: ReactNode
  onClose: () => void
  headingRef?: Ref<HTMLHeadingElement>
  children?: ReactNode
}

export const Terminal = forwardRef<HTMLElement, TerminalProps>(function Terminal({ title, icon, sub, onClose, headingRef, className, children, ...rest }, ref) {
  return (
    <section ref={ref} className={`term${className ? ` ${className}` : ''}`} {...rest}>
      <header className="term-head">
        <Button variant="ghost" size="sm" icon="arrowUp" className="term-back" onClick={onClose} aria-label="Back to the map" aria-keyshortcuts="Escape">
          Map
        </Button>
        <div className="term-titles">
          <h2 className="term-title" tabIndex={-1} ref={headingRef}>
            <Icon name={icon} size={24} />
            {title}
            <span className="term-badge caps" aria-hidden="true">
              terminal
            </span>
          </h2>
          {sub ? <p className="term-sub">{sub}</p> : null}
        </div>
        <kbd className="term-esc" aria-hidden="true">
          Esc
        </kbd>
      </header>
      <div className="term-body">
        <div className="term-inner">{children}</div>
      </div>
    </section>
  )
})
