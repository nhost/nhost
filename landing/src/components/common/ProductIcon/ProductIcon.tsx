import Image from 'next/image'
import { HTMLProps, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ProductIcon({
  children,
  className,
}: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
  return (
    <div className={twMerge('relative h-12 w-12', className)}>
      <div className="absolute inset-px z-20 flex items-center justify-center rounded-full bg-black">
        {children}
      </div>

      <Image
        src="/common/product-icon-frame.svg"
        width={50}
        height={50}
        className="absolute h-full w-full"
        alt="A gradient border"
      />
    </div>
  )
}
