import Link from 'next/link';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { isRouteActive } from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

const RouteTabsPresentationContext = createContext<'desktop' | 'mobile'>(
  'desktop',
);

export interface RouteTabsProps
  extends Omit<ComponentPropsWithoutRef<'nav'>, 'aria-label' | 'children'> {
  'aria-label': string;
  children: ReactNode;
  listClassName?: string;
}

function DesktopRouteTabs({
  children,
  className,
  listClassName,
  ...props
}: RouteTabsProps) {
  return (
    <nav className={cn('overflow-x-auto', className)} {...props}>
      <div
        className={cn(
          'inline-flex h-10 items-center justify-start gap-6 text-muted-foreground',
          listClassName,
        )}
      >
        {children}
      </div>
    </nav>
  );
}

function MobileRouteTabs({
  children,
  className,
  ...props
}: Omit<RouteTabsProps, 'listClassName'>) {
  const router = useRouter();
  const activeTab = Children.toArray(children).find(
    (child): child is ReactElement<RouteTabLinkProps> =>
      isValidElement<RouteTabLinkProps>(child) &&
      typeof child.props.href === 'string' &&
      isRouteActive(router.asPath, child.props.href, child.props.exact),
  );

  return (
    <nav className={cn('w-full min-w-0', className)} {...props}>
      <Select
        value={activeTab?.props.href ?? ''}
        onValueChange={(href) => {
          void router.push(href);
        }}
      >
        <SelectTrigger aria-label={props['aria-label']} className="h-11">
          <SelectValue placeholder="Navigate" />
        </SelectTrigger>
        <SelectContent
          align="start"
          className="max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-0"
        >
          {children}
        </SelectContent>
      </Select>
    </nav>
  );
}

export function RouteTabs({ listClassName, ...props }: RouteTabsProps) {
  const isDesktop = useMediaQuery('md');

  return (
    <RouteTabsPresentationContext.Provider
      value={isDesktop ? 'desktop' : 'mobile'}
    >
      {isDesktop ? (
        <DesktopRouteTabs {...props} listClassName={listClassName} />
      ) : (
        <MobileRouteTabs {...props} />
      )}
    </RouteTabsPresentationContext.Provider>
  );
}

export interface RouteTabLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'aria-current' | 'href'> {
  href: string;
  exact?: boolean;
  disabled?: boolean;
}

export function RouteTabLink({
  children,
  className,
  disabled,
  exact = false,
  href,
  ...props
}: RouteTabLinkProps) {
  const isMobile = useContext(RouteTabsPresentationContext) === 'mobile';
  const { asPath } = useRouter();

  if (isMobile) {
    return (
      <SelectItem
        value={href}
        disabled={disabled}
        className={cn('min-h-11 whitespace-normal', className)}
      >
        {children}
      </SelectItem>
    );
  }

  const active = isRouteActive(asPath, href, exact);
  const tabClassName = cn(
    'inline-flex h-10 items-center justify-center whitespace-nowrap border-transparent border-b-2 px-0 font-medium text-sm ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:border-foreground data-[state=active]:text-foreground',
    disabled && 'pointer-events-none opacity-50 hover:text-muted-foreground',
    className,
  );

  return disabled ? (
    <span
      aria-current={active ? 'page' : undefined}
      aria-disabled="true"
      className={tabClassName}
      data-state={active ? 'active' : 'inactive'}
    >
      {children}
    </span>
  ) : (
    <Link
      aria-current={active ? 'page' : undefined}
      className={tabClassName}
      data-state={active ? 'active' : 'inactive'}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}

export function RouteTabSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<'span'>) {
  const isMobile = useContext(RouteTabsPresentationContext) === 'mobile';

  if (isMobile) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={cn('h-5 w-px shrink-0 bg-border', className)}
      {...props}
    />
  );
}
