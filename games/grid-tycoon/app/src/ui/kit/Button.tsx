import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './icons'
import type { IconName } from './icons'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'money'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  /** Icon after the label instead of before. */
  iconEnd?: IconName
  block?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconEnd, block, className, children, type = 'button', ...rest },
  ref,
) {
  const cls = ['btn', `btn-${variant}`, `btn-${size}`, block ? 'btn-block' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {icon ? <Icon name={icon} size={size === 'lg' ? 20 : 16} /> : null}
      {children != null ? <span className="btn-label">{children}</span> : null}
      {iconEnd ? <Icon name={iconEnd} size={size === 'lg' ? 20 : 16} /> : null}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  /** Required: icon-only buttons need an accessible name. */
  label: string
  variant?: 'ghost' | 'secondary' | 'primary'
  size?: ButtonSize
  /** For toggles: sets aria-pressed. */
  pressed?: boolean
  /** Small number badge (e.g. undo steps). */
  badge?: number | string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', pressed, badge, className, type = 'button', title, ...rest },
  ref,
) {
  const cls = ['icon-btn', `btn-${variant}`, `icon-btn-${size}`, className ?? ''].filter(Boolean).join(' ')
  return (
    <button ref={ref} type={type} className={cls} aria-label={label} title={title ?? label} aria-pressed={pressed} {...rest}>
      <Icon name={icon} size={size === 'lg' ? 24 : size === 'sm' ? 16 : 20} />
      {badge != null && badge !== 0 ? (
        <span className="icon-btn-badge num" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  )
})
