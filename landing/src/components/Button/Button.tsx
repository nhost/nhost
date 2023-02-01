import { createElement, DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { Link } from '../Link'

export interface ButtonProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLButtonElement>, HTMLButtonElement>,
    'size'
  > {
  /**
   * Variant of the button.
   *
   * @default 'contained'
   */
  variant?: 'contained' | 'borderless'
  /**
   * Color of the button.
   *
   * @default 'primary'
   */
  color?: 'primary' | 'secondary'
  /**
   * Size of the button.
   *
   * @default 'large'
   */
  size?: 'small' | 'large'
}

export default function Button({
  variant = 'contained',
  color = 'primary',
  size = 'large',
  children,
  className,
  ...props
}: ButtonProps) {
  return createElement(
    props.href ? Link : 'button',
    {
      className: twMerge(
        'inline-grid grid-flow-col gap-2 items-center font-medium rounded-md motion-safe:transition-all hover:no-underline',
        variant === 'contained' &&
          'bg-white text-black text-opacity-100 hover:ring-2',
        variant === 'borderless' &&
          'bg-transparent text-white text-opacity-100 hover:bg-white hover:bg-opacity-10',
        size === 'small' && 'px-4 py-2',
        size === 'large' && 'px-6 py-3',
        className,
      ),
      ...(props as any),
    },
    children,
  )
}
