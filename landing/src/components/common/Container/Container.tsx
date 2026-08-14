import {
  createElement,
  DetailedHTMLProps,
  ElementType,
  ForwardedRef,
  forwardRef,
  HTMLProps,
  PropsWithoutRef,
} from 'react'
import { twMerge } from 'tailwind-merge'

export interface ContainerProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {
  /**
   * Custom component to render as.
   */
  component?: ElementType<any>
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the root component.
     */
    root?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
    /**
     * Props passed to the content component.
     */
    content?: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  }
}

function Container(
  {
    component = 'div',
    className,
    children,
    slotProps,
    ...props
  }: ContainerProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return createElement(
    component,
    {
      ...props,
      ...(slotProps?.root || {}),
      ref,
      className: twMerge('w-full', slotProps?.root?.className),
    },
    <div
      {...(slotProps?.content || {})}
      className={twMerge(
        'mx-auto max-w-7xl',
        className,
        slotProps?.content?.className,
      )}
    >
      {children}
    </div>,
  )
}

export default forwardRef(Container)
