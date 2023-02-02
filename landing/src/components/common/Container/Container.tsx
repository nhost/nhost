import { createElement, DetailedHTMLProps, ElementType, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ContainerProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Custom component to render as.
   */
  component?: ElementType<any>
  slotProps?: {
    root?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
    content?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  }
}

export default function Container({
  component = 'div',
  className,
  children,
  slotProps,
  ...props
}: ContainerProps) {
  return createElement(
    component,
    {
      ...props,
      ...(slotProps?.root || {}),
      className: twMerge('w-full', slotProps?.root?.className),
    },
    <div
      {...(slotProps?.content || {})}
      className={twMerge(
        'mx-auto max-w-7xl px-5',
        className,
        slotProps?.content?.className,
      )}
    >
      {children}
    </div>,
  )
}
