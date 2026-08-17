import { DetailedHTMLProps, HTMLProps } from 'react'
import Zoom from 'react-medium-image-zoom'
import { twMerge } from 'tailwind-merge'

export default function ImageWithLegend({
  alt,
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLImageElement>, HTMLImageElement>) {
  return (
    <span className="my-2 grid grid-flow-row content-start justify-items-center gap-2">
      <Zoom wrapElement="span" classDialog="bg-black">
        <img alt={alt} className={twMerge('my-0', className)} {...props} />
      </Zoom>

      {alt && <span className="mt-0 text-xs">{alt}</span>}
    </span>
  )
}
