import { createLink } from '@tanstack/react-router';
import { type ComponentPropsWithoutRef, forwardRef, type Ref } from 'react';
import { useIsLinkActive } from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

export interface SidebarItemAnchorProps extends ComponentPropsWithoutRef<'a'> {
  /** The path whose pages mark the item active, when it differs from the link. */
  activePath?: string;
  /** Only the target itself marks the item active, not the pages below it. */
  exact?: boolean;
  disabled?: boolean;
}

/**
 * The anchor behind `SidebarItem`, with the shared hover, active and disabled
 * look. It works out whether it is active from the current route. A disabled
 * item renders as a non-interactive span. Render it through a router link
 * (`SidebarItem`, or `createLink`), which supplies `href` and the click
 * handling.
 */
export const SidebarItemAnchor = forwardRef<
  HTMLElement,
  SidebarItemAnchorProps
>(
  (
    {
      activePath,
      exact = false,
      disabled = false,
      href,
      className,
      children,
      'aria-current': ariaCurrent,
      ...props
    },
    ref,
  ) => {
    const active = useIsLinkActive({ href, activePath, exact, ariaCurrent });
    // The dark-mode repeats are needed: `dark:text-sidebar-foreground` would
    // otherwise win over the plain hover and active colors.
    const itemClassName = cn(
      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 font-semibold text-neutral-600 text-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-sidebar-foreground dark:hover:bg-accent dark:hover:text-foreground',
      active &&
        'bg-neutral-100 text-primary hover:bg-neutral-100 hover:text-primary dark:bg-muted dark:text-primary dark:hover:bg-muted dark:hover:text-primary',
      disabled &&
        'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-neutral-600 dark:hover:bg-transparent dark:hover:text-sidebar-foreground',
      className,
    );

    if (disabled) {
      // Keep the DOM props, so a wrapping `TooltipTrigger asChild` still gets
      // its pointer and focus handlers. Drop the link's `onClick`.
      const { onClick: _onClick, role: _role, ...spanProps } = props;

      return (
        <span
          ref={ref as Ref<HTMLSpanElement>}
          {...spanProps}
          aria-current={active ? 'page' : undefined}
          aria-disabled="true"
          className={itemClassName}
        >
          {children}
        </span>
      );
    }

    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        {...props}
        aria-current={active ? 'page' : undefined}
        className={itemClassName}
      >
        {children}
      </a>
    );
  },
);
SidebarItemAnchor.displayName = 'SidebarItemAnchor';

/**
 * A sidebar navigation link. Takes the router's link options (`to`,
 * `params`, `search`) plus `activePath`, `exact` and `disabled`.
 */
const SidebarItem = createLink(SidebarItemAnchor);

export default SidebarItem;
