import type { ImageProps } from 'next/image';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface LineGridProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Whether to use the priority loading strategy for the image.
   */
  priority?: boolean;
  /**
   * Props passed to component slots.
   */
  slotProps?: {
    /**
     * Props passed to the image slot.
     */
    image?: Partial<ImageProps>;
  };
}

export default function LineGrid({
  className,
  slotProps,
  priority,
  ...props
}: LineGridProps) {
  return (
    <div
      className={twMerge('absolute z-0 h-full w-full', className)}
      {...props}
    >
      <Image
        {...(slotProps?.image || {})}
        priority={priority || slotProps?.image?.priority}
        src="/assets/line-grid.svg"
        width={1003}
        height={644}
        alt="Transparent lines"
        objectFit="none"
        className={twMerge('h-full', slotProps?.image?.className)}
      />
    </div>
  );
}
