import Image from 'next/image'
import { PropsWithChildren } from 'react'

export default function ProductIcon({ children }: PropsWithChildren<unknown>) {
  return (
    <div className="relative h-12 w-12">
      <div className="absolute top-px right-px bottom-px left-px z-20 flex items-center justify-center rounded-full bg-black">
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
