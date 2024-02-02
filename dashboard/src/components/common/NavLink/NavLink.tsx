import type { LinkProps } from '@/components/ui/v2/Link';
import { Link } from '@/components/ui/v2/Link';
import NextLink from 'next/link';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface NavLinkProps extends PropsWithoutRef<LinkProps> {
  /**
   * Determines whether or not the link should be disabled.
   */
  disabled?: boolean;
}

function NavLink(
  { className, children, href, ...props }: NavLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <NextLink href={href} passHref legacyBehavior>
      <Link className={twMerge('font-display', className)} ref={ref} {...props}>
        {children}
      </Link>
    </NextLink>
  );
}

export default forwardRef(NavLink);
