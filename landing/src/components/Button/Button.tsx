import { createElement, DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

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
    props.href ? 'a' : 'button',
    {
      className: twMerge(
        'inline-block text-sm font-medium rounded-md motion-safe:transition-all',
        variant === 'contained' && 'bg-white text-black hover:ring-2',
        variant === 'borderless' &&
          'bg-transparent text-white hover:bg-white hover:bg-opacity-10',
        size === 'small' && 'px-4 py-1',
        size === 'large' && 'px-6 py-3',
        className,
      ),
      ...props,
    },
    children,
  )
}
