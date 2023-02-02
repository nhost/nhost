import {
  createElement,
  DetailedHTMLProps,
  ElementType,
  HTMLProps,
  ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'

export interface SectionHeadingProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
  /**
   * The title of the section.
   */
  title: ReactNode
  /**
   * The subtitle of the section.
   */
  subtitle: ReactNode
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the root slot.
     */
    root?: HTMLProps<HTMLDivElement>
    /**
     * Props passed to the title slot.
     */
    title?: HTMLProps<HTMLHeadingElement> & { component?: ElementType<any> }
    /**
     * Props passed to the subtitle slot.
     */
    subtitle?: HTMLProps<HTMLParagraphElement>
  }
}

export default function SectionHeading({
  title,
  subtitle,
  className,
  slotProps,
  ...props
}: SectionHeadingProps) {
  const { component: titleComponent, ...titleSlotProps } =
    slotProps?.title || {}
  return (
    <div
      className={twMerge(
        'mx-auto grid max-w-2xl grid-flow-row gap-4 text-center',
        slotProps?.root?.className,
        className,
      )}
      {...(slotProps?.root || {})}
      {...props}
    >
      {createElement(
        titleComponent || 'h2',
        {
          ...titleSlotProps,
          className: twMerge(
            'font-mona text-4.5xl font-bold',
            titleSlotProps.className,
          ),
        },
        title,
      )}

      <p
        {...(slotProps?.subtitle || {})}
        className={twMerge(
          'text-xl font-normal text-white text-opacity-65',
          slotProps?.subtitle?.className,
        )}
      >
        {subtitle}
      </p>
    </div>
  )
}
