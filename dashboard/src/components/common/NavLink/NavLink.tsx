import NextLink from 'next/link';
import { type ForwardedRef, forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

export type NavLinkProps = {
  underline?: 'none' | 'always' | 'hover';
  href: string;
  variant?: ButtonProps['variant'];
} & ButtonProps &
  Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'>;

function NavLink(
  {
    className,
    children,
    href,
    underline,
    target,
    rel,
    variant = 'link',
    disabled,
    ...props
  }: NavLinkProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  return (
    <Button
      asChild
      variant={variant}
      disabled={disabled}
      className={cn(
        'mr-0 h-8 font-display',
        underline === 'none' && 'no-underline hover:no-underline',
        underline === 'always' && 'underline',
        underline === 'hover' && 'hover:underline',
        disabled && 'pointer-events-none text-disabled opacity-60',
        className,
      )}
      ref={ref}
      {...props}
    >
      <NextLink
        href={href}
        target={target}
        rel={rel}
        tabIndex={disabled ? -1 : undefined}
        aria-disabled={disabled}
      >
        {children}
      </NextLink>
    </Button>
  );
}

export default forwardRef(NavLink);
