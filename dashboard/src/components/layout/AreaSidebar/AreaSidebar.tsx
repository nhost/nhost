import Link from 'next/link';
import { type NextRouter, useRouter } from 'next/router';
import {
  Children,
  type ComponentPropsWithoutRef,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from 'react';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { isQueryActive, isRouteActive } from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

const AreaSidebarPresentationContext = createContext<'desktop' | 'mobile'>(
  'desktop',
);

export interface AreaSidebarRootProps
  extends Omit<ComponentPropsWithoutRef<'aside'>, 'children'> {
  children: ReactNode;
}

export function AreaSidebarRoot({
  children,
  className,
  ...props
}: AreaSidebarRootProps) {
  return (
    <aside
      className={cn(
        'w-full shrink-0 md:h-full md:w-56 md:overflow-auto',
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export interface AreaSidebarNavProps
  extends Omit<ComponentPropsWithoutRef<'nav'>, 'aria-label' | 'children'> {
  ariaLabel: string;
  /** Declare links directly or inside groups/fragments so mobile navigation can discover them. */
  children: ReactNode;
}

function getSidebarLinks(
  children: ReactNode,
): ReactElement<AreaSidebarLinkProps>[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      isValidElement<AreaSidebarLinkProps>(child) &&
      (typeof child.props.href === 'string' ||
        (typeof child.props.href === 'object' && child.props.href !== null))
    ) {
      return [child];
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      return getSidebarLinks(child.props.children);
    }
    return [];
  });
}

function getLinkValue(href: AreaSidebarLinkProps['href']) {
  return typeof href === 'string' ? href : JSON.stringify(href);
}

function isSidebarLinkActive(
  router: NextRouter,
  { href, exact }: Pick<AreaSidebarLinkProps, 'href' | 'exact'>,
) {
  if (typeof href === 'string') {
    return isRouteActive(router.asPath, href, exact);
  }

  const path = href.pathname ?? router.pathname;
  return (
    (isRouteActive(router.asPath, path, exact) ||
      isRouteActive(router.pathname, path, exact)) &&
    isQueryActive(router.query, href.search || href.query)
  );
}

function MobileAreaSidebar({
  ariaLabel,
  children,
}: Pick<AreaSidebarNavProps, 'ariaLabel' | 'children'>) {
  const router = useRouter();
  const links = getSidebarLinks(children);
  const activeLink = links.find((link) =>
    isSidebarLinkActive(router, link.props),
  );

  return (
    <Select
      value={activeLink ? getLinkValue(activeLink.props.href) : ''}
      onValueChange={(value) => {
        const link = links.find(
          (item) => getLinkValue(item.props.href) === value,
        );
        if (!link || link.props.disabled) {
          return;
        }
        const { href, as, replace, shallow, scroll, locale } = link.props;
        void router[replace ? 'replace' : 'push'](href, as, {
          shallow,
          scroll,
          locale,
        });
      }}
    >
      <SelectTrigger aria-label={ariaLabel} className="h-11">
        <SelectValue placeholder="Navigate" />
      </SelectTrigger>
      <SelectContent
        align="start"
        className="max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-0"
      >
        {children}
      </SelectContent>
    </Select>
  );
}

export function AreaSidebarNav({
  ariaLabel,
  children,
  className,
  ...props
}: AreaSidebarNavProps) {
  const isDesktop = useMediaQuery('md');

  return (
    <AreaSidebarPresentationContext.Provider
      value={isDesktop ? 'desktop' : 'mobile'}
    >
      <nav
        aria-label={ariaLabel}
        className={cn(
          isDesktop
            ? 'flex h-full min-h-0 flex-col gap-6 px-4 py-6'
            : 'min-w-0 px-5 pt-2',
          className,
        )}
        {...props}
      >
        {isDesktop ? (
          children
        ) : (
          <MobileAreaSidebar ariaLabel={ariaLabel}>
            {children}
          </MobileAreaSidebar>
        )}
      </nav>
    </AreaSidebarPresentationContext.Provider>
  );
}

export interface AreaSidebarGroupProps
  extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  children: ReactNode;
  label?: string;
  labelClassName?: string;
  listClassName?: string;
}

export function AreaSidebarGroup({
  children,
  className,
  label,
  labelClassName,
  listClassName,
  ...props
}: AreaSidebarGroupProps) {
  const isMobile = useContext(AreaSidebarPresentationContext) === 'mobile';

  if (isMobile) {
    return (
      <SelectGroup className={cn('pt-3 first:pt-0', className)} {...props}>
        {label && (
          <SelectLabel
            className={cn(
              'px-3 py-2 text-2xs text-muted-foreground uppercase tracking-[0.16em]',
              labelClassName,
            )}
          >
            {label}
          </SelectLabel>
        )}
        {children}
      </SelectGroup>
    );
  }

  return (
    <section className={className} {...props}>
      {label && (
        <h2
          className={cn(
            'px-3 pb-2 font-semibold text-2xs text-muted-foreground uppercase tracking-[0.16em]',
            labelClassName,
          )}
        >
          {label}
        </h2>
      )}
      <ul className={cn('flex flex-col gap-1', listClassName)}>{children}</ul>
    </section>
  );
}

export interface AreaSidebarLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'aria-current'> {
  exact?: boolean;
  disabled?: boolean;
  itemClassName?: string;
}

export function AreaSidebarLink({
  children,
  className,
  disabled,
  exact = false,
  href,
  itemClassName,
  ...props
}: AreaSidebarLinkProps) {
  const isMobile = useContext(AreaSidebarPresentationContext) === 'mobile';
  const router = useRouter();

  if (isMobile) {
    return (
      <SelectItem
        value={getLinkValue(href)}
        disabled={disabled}
        className={cn('min-h-11 whitespace-normal', className, itemClassName)}
      >
        {children}
      </SelectItem>
    );
  }

  const active = isSidebarLinkActive(router, { href, exact });
  const linkClassName = cn(
    'flex h-10 w-full items-center rounded-lg pr-3 pl-6 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    active && 'bg-muted text-primary hover:bg-muted hover:text-primary',
    disabled &&
      'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
    itemClassName,
  );

  return (
    <li className={className}>
      {disabled ? (
        <span
          aria-current={active ? 'page' : undefined}
          aria-disabled="true"
          className={linkClassName}
        >
          {children}
        </span>
      ) : (
        <Link
          aria-current={active ? 'page' : undefined}
          className={linkClassName}
          href={href}
          {...props}
        >
          {children}
        </Link>
      )}
    </li>
  );
}
