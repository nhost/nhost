import { FC } from 'react'
import Image from 'next/image'

const AIVisual: FC = () => (
  <div className="flex h-24 w-full items-center justify-center gap-2 overflow-hidden rounded-md p-2">
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-divider bg-paper text-sm text-brand-light transition-colors group-hover:border-brand-main dark:bg-default/50">
      <Image
        src="/products/openai-logo.svg"
        width={56}
        height={56}
        alt="AI Services Icon"
        className="opacity-80 transition-opacity group-hover:opacity-100"
      />
    </div>
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-divider bg-paper text-sm text-brand-light transition-colors group-hover:border-brand-main dark:bg-default/50">
      <Image
        src="/products/graphite-logo.svg"
        width={56}
        height={56}
        alt="AI Services Icon"
        className="opacity-80 transition-opacity group-hover:opacity-100"
      />
    </div>
  </div>
)

export default AIVisual
