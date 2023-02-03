import Image from 'next/image'
import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export interface LineGridProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

export default function LineGrid({ className, ...props }: LineGridProps) {
  return (
    <div
      className={twMerge(
        'absolute z-0 h-full w-full -translate-x-1/4 scale-[1.4]',
        className,
      )}
      {...props}
    >
      <Image
        src="/common/line-grid.svg"
        width={1003}
        height={644}
        alt="Transparent lines"
        className="h-full object-cover opacity-65"
      />
    </div>
  )
}
