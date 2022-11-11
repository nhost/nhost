import Link from 'next/link';
import type { DetailedHTMLProps, ForwardedRef, HTMLProps } from 'react';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface NavLinkProps
  extends DetailedHTMLProps<HTMLProps<HTMLAnchorElement>, HTMLAnchorElement> {}

function NavLink(
  { className, children, href, ...props }: NavLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <Link href={href} passHref>
      <a className={twMerge('font-display', className)} ref={ref} {...props}>
        {children}
      </a>
    </Link>
  );
}

export default forwardRef(NavLink);
