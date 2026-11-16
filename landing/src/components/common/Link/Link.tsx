import NextLink, { LinkProps as NextLinkProps } from 'next/link'
import { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react'
import { twMerge } from 'tailwind-merge'

export interface LinkProps
  extends Omit<
      PropsWithoutRef<
        DetailedHTMLProps<HTMLProps<HTMLAnchorElement>, HTMLAnchorElement>
      >,
      'href' | 'as'
    >,
    NextLinkProps {}

export default function Link({ className, ...props }: LinkProps) {
  return (
    <NextLink
      className={twMerge(
        'inline-grid grid-flow-col items-center justify-start gap-2 text-white text-opacity-65 hover:underline',
        className,
      )}
      {...props}
    />
  )
}
