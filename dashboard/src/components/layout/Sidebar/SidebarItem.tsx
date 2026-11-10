import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ComponentPropsWithoutRef, forwardRef, type Ref } from 'react';
import { isLinkActive } from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

interface SidebarItemProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'aria-current'> {
  /** The path whose pages mark the item active, when it differs from `href`. */
  activePath?: string;
  /** Only the target itself marks the item active, not the pages below it. */
  exact?: boolean;
  disabled?: boolean;
}

/**
 * A sidebar navigation link with the shared hover, active and disabled look.
 * It works out whether it is active from the current route. A disabled item
 * renders as a non-interactive span.
 */
const SidebarItem = forwardRef<HTMLElement, SidebarItemProps>(
  (
    {
      activePath,
      exact = false,
      disabled = false,
      href,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const router = useRouter();
    const active = isLinkActive(router, activePath ?? href, exact);
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
      // its pointer and focus handlers. Drop the Link-only props and `onClick`.
      const {
        as: _as,
        replace: _replace,
        scroll: _scroll,
        shallow: _shallow,
        passHref: _passHref,
        prefetch: _prefetch,
        locale: _locale,
        legacyBehavior: _legacyBehavior,
        onNavigate: _onNavigate,
        onClick: _onClick,
        ...spanProps
      } = props;

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
      <Link
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={itemClassName}
        {...props}
      >
        {children}
      </Link>
    );
  },
);
SidebarItem.displayName = 'SidebarItem';

export default SidebarItem;
