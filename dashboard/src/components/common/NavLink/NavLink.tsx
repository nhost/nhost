import { createLink, type LinkComponentProps } from '@tanstack/react-router';
import {
  type AnchorHTMLAttributes,
  type ForwardedRef,
  forwardRef,
} from 'react';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

export type NavLinkAnchorProps = {
  underline?: 'none' | 'always' | 'hover';
  variant?: ButtonProps['variant'];
} & Omit<ButtonProps, 'asChild'> &
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'>;

function NavLinkAnchor(
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
  }: NavLinkAnchorProps,
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
      <a
        href={href}
        target={target}
        rel={rel}
        tabIndex={disabled ? -1 : undefined}
        aria-disabled={disabled}
      >
        {children}
      </a>
    </Button>
  );
}

/**
 * A button-styled link to a dashboard page. Takes the router's link options
 * (`to`, `params`, `search`) plus the button's `variant` and `underline`.
 */
const NavLink = createLink(forwardRef(NavLinkAnchor));

export type NavLinkProps = LinkComponentProps<typeof NavLinkAnchor>;

export default NavLink;
