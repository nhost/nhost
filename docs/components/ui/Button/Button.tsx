import cn from 'classnames'
import React, { ButtonHTMLAttributes, forwardRef, JSXElementConstructor, useRef } from 'react'
import mergeRefs from 'react-merge-refs'

import s from './Button.module.css'

// import Loading from "../components/ui/Loading";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string
  className?: string
  variant?: 'primary' | 'dark' | 'secondary' | 'menu' | 'danger'
  color?: 'blue' | 'red'
  active?: boolean
  type?: 'submit' | 'reset' | 'button'
  Component?: string | JSXElementConstructor<any>
  width?: string | number
  loading?: boolean
  disabled?: boolean
  small?: boolean
  transparent?: boolean
  target?: string
  rel?: string
  onClick?: any
  border?: boolean
}

// eslint-disable-next-line react/display-name
export const Button: React.FC<ButtonProps> = forwardRef((props, buttonRef) => {
  const {
    className,
    variant,
    children,
    active,
    width,
    small,
    href,
    color,
    border,
    loading = false,
    disabled = false,
    transparent = false,
    style = {},
    type = 'button',
    Component = 'button',
    ...rest
  } = props
  const ref = useRef<typeof Component>(null)

  const rootClassName = cn(
    s.root,
    {
      [s.primary]: variant === 'primary',
      [s.secondary]: variant === 'secondary',
      [s.menu]: variant === 'menu',
      [s.dark]: variant === 'dark',
      [s.danger]: variant === 'danger',
      [s.loading]: loading,
      [s.disabled]: disabled,
      [s.small]: small,
      [s.transparent]: transparent,
      [s.blue]: color === 'blue',
      [s.red]: color === 'red',
      [s.border]: border
    },
    className
  )

  return (
    <Component
      aria-pressed={active}
      data-variant={variant}
      ref={mergeRefs([ref, buttonRef])}
      className={rootClassName}
      disabled={disabled}
      type={type}
      href={href}
      style={{
        width,
        ...style
      }}
      {...rest}
    >
      {children}
    </Component>
  )
})

export default Button
