import Image, { ImageProps } from 'next/image'
import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export interface LineGridProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the image slot.
     */
    image?: Partial<ImageProps>
  }
}

export default function LineGrid({
  className,
  slotProps,
  ...props
}: LineGridProps) {
  return (
    <div
      className={twMerge('absolute z-0 h-full w-full', className)}
      {...props}
    >
      <Image
        {...(slotProps?.image || {})}
        src="/common/line-grid.svg"
        width={1003}
        height={644}
        alt="Transparent lines"
        className={twMerge(
          'h-full object-none opacity-65',
          slotProps?.image?.className,
        )}
      />
    </div>
  )
}
