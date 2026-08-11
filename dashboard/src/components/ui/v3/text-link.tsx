import { ExternalLinkIcon } from 'lucide-react';
import NextLink from 'next/link';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextLinkProps = React.ComponentPropsWithoutRef<typeof NextLink> & {
  external?: boolean;
};

const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(
  (
    { href, children, external = false, target, rel, className, ...props },
    ref,
  ) => (
    <NextLink
      ref={ref}
      href={href}
      target={target ?? (external ? '_blank' : undefined)}
      rel={rel ?? (external ? 'noopener noreferrer' : undefined)}
      className={cn(
        'text-primary underline-offset-4 hover:underline',
        external && 'inline-flex items-center gap-1',
        className,
      )}
      {...props}
    >
      {children}
      {external && (
        <ExternalLinkIcon className="h-4 w-4" aria-hidden focusable={false} />
      )}
    </NextLink>
  ),
);
TextLink.displayName = 'TextLink';

export { TextLink };
