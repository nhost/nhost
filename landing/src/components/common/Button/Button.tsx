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
  variant?: 'contained' | 'borderless' | 'outlined'
  /**
   * Color of the button.
   *
   * @default 'primary'
   */
  color?: 'primary' | 'secondary'
  /**
   * Size of the button.
   *
   * @default 'lg'
   */
  size?: 'xs' | 'sm' | 'lg'
}

export default function Button({
  variant = 'contained',
  color = 'primary',
  size = 'lg',
  children,
  className,
  ...props
}: ButtonProps) {
  return createElement(
    props.href ? Link : 'button',
    {
      className: twMerge(
        'inline-grid grid-flow-col gap-2 items-center font-medium rounded-md motion-safe:transition-highlight hover:no-underline border border-transparent',
        variant === 'contained' &&
          'bg-white text-black text-opacity-100 hover:ring-2 ring-white ring-opacity-50',
        variant === 'borderless' &&
          'bg-transparent text-white text-opacity-100 hover:bg-white hover:bg-opacity-10',
        variant === 'outlined' &&
          'bg-default text-white text-opacity-100 hover:bg-white hover:bg-opacity-10 border border-divider',
        size === 'xs' && 'px-2 py-1 gap-1 leading-[18px]',
        size === 'sm' && 'px-4 py-2 gap-1 leading-[18px]',
        size === 'lg' && 'px-6 py-3',
        className,
      ),
      ...(props as any),
    },
    children,
  )
}
