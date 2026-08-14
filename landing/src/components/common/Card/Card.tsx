import { DetailedHTMLProps, HTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CardProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

export default function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={twMerge(
        'overflow-hidden rounded-md border border-divider p-8',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
