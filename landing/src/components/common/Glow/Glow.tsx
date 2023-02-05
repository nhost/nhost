import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export interface GlowProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

export default function Glow({ className, ...props }: GlowProps) {
  return (
    <div
      className={twMerge(
        'absolute left-0 right-0 z-0 mx-auto h-20 w-20 rounded-full bg-brand-main blur-[56px]',
        className,
      )}
      {...props}
    />
  )
}
