import type { PropsWithChildren, Ref } from 'react';
import { cn } from '@/lib/utils';
import NavLink, { type NavLinkProps } from './NavLink';

function ListNavLink({
  className,
  children,
  ref,
  ...props
}: PropsWithChildren<NavLinkProps> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <NavLink
      ref={ref}
      variant="ghost"
      className={cn('h-9 w-full justify-start px-2', className)}
      {...props}
    >
      {children}
    </NavLink>
  );
}

export default ListNavLink;
