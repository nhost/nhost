import type Link from 'next/link';
import { useRouter } from 'next/router';
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
import { SidebarItem, SidebarSectionTitle } from '@/components/layout/Sidebar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { isLinkActive } from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

const AreaSidebarPresentationContext = createContext<'desktop' | 'mobile'>(
  'desktop',
);

interface AreaSidebarRootProps
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

interface AreaSidebarNavProps
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

function MobileAreaSidebar({
  ariaLabel,
  children,
}: Pick<AreaSidebarNavProps, 'ariaLabel' | 'children'>) {
  const router = useRouter();
  const links = getSidebarLinks(children);
  const activeLink = links.find((link) =>
    isLinkActive(router, link.props.href, link.props.exact),
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
            ? 'flex h-full min-h-0 flex-col gap-[1.2rem] p-2'
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

interface AreaSidebarGroupProps
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
        <SidebarSectionTitle className={labelClassName}>
          {label}
        </SidebarSectionTitle>
      )}
      <ul className={cn('flex flex-col', listClassName)}>{children}</ul>
    </section>
  );
}

interface AreaSidebarLinkProps
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

  return (
    <li className={className}>
      <SidebarItem
        href={href}
        exact={exact}
        disabled={disabled}
        className={itemClassName}
        {...props}
      >
        {children}
      </SidebarItem>
    </li>
  );
}
