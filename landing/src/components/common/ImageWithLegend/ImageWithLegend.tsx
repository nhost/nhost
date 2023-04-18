import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ImageWithLegend({
  alt,
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLImageElement>, HTMLImageElement>) {
  return (
    <span className="my-2 grid grid-flow-row content-start justify-items-center gap-2">
      <img alt={alt} className={twMerge('my-0', className)} {...props} />

      {alt && <span className="text-xs">{alt}</span>}
    </span>
  )
}
