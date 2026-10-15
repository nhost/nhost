import { createLink, type LinkComponentProps } from '@tanstack/react-router';
import { ExternalLinkIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextAnchorProps = React.ComponentPropsWithoutRef<'a'> & {
  /** Opens the link in a new tab and shows an external-link icon. */
  external?: boolean;
};

/**
 * A text link to a URL outside the dashboard (docs, GitHub, `mailto:`). Use
 * `TextLink` for dashboard pages.
 */
const TextAnchor = React.forwardRef<HTMLAnchorElement, TextAnchorProps>(
  ({ children, external = false, target, rel, className, ...props }, ref) => (
    <a
      ref={ref}
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
    </a>
  ),
);
TextAnchor.displayName = 'TextAnchor';

/**
 * A text link to a dashboard page. Takes the router's link options (`to`,
 * `params`, `search`).
 */
const TextLink = createLink(TextAnchor);

export type TextLinkProps = LinkComponentProps<typeof TextAnchor>;

export { TextAnchor, TextLink };
