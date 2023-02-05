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

      {/* <div className="radial-inner absolute top-0 bottom-0 right-0 left-0 z-0 rounded-full opacity-10"></div>
      <div className="radial-outer absolute top-0 bottom-0 right-0 left-0 z-10 rounded-full opacity-50"></div> */}
    </div>
  )
}
