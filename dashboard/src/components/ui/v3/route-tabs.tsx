import {
  createLink,
  type LinkComponent,
  type LinkComponentProps,
  useRouter,
} from '@tanstack/react-router';
import {
  Children,
  type ComponentPropsWithoutRef,
  createContext,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  useContext,
  useId,
} from 'react';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  isRouteActive,
  useCurrentHref,
  useIsLinkActive,
} from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

const RouteTabsPresentationContext = createContext<'desktop' | 'mobile'>(
  'desktop',
);

interface RouteTabsProps
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
          'inline-flex h-10 items-center justify-start gap-6 text-muted-foreground dark:text-sidebar-foreground',
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
  const currentHref = useCurrentHref();
  // The tabs' select values are the hrefs they build (see RouteTabLinkAnchor),
  // so they can be compared with the current one.
  const tabs = Children.toArray(children)
    .filter(
      (child): child is ReactElement<RouteTabLinkProps> =>
        isValidElement<RouteTabLinkProps>(child) && child.type === RouteTabLink,
    )
    .map((tab) => ({ tab, href: router.buildLocation(tab.props).href }));
  const activeTab = tabs.find(({ tab, href }) =>
    isRouteActive(currentHref, href, tab.props.exact),
  );

  return (
    <nav className={cn('w-full min-w-0', className)} {...props}>
      <Select
        value={activeTab?.href ?? ''}
        onValueChange={(href) => {
          void router.navigate({ href });
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

interface RouteTabLinkAnchorProps extends ComponentPropsWithoutRef<'a'> {
  exact?: boolean;
  disabled?: boolean;
}

const RouteTabLinkAnchor = forwardRef<HTMLElement, RouteTabLinkAnchorProps>(
  (
    {
      children,
      className,
      disabled,
      exact = false,
      href,
      'aria-current': ariaCurrent,
      ...props
    },
    ref,
  ) => {
    const isMobile = useContext(RouteTabsPresentationContext) === 'mobile';
    const active = useIsLinkActive({ href, exact, ariaCurrent });
    // A disabled tab has no href; it only needs a unique select value.
    const disabledValue = useId();

    if (isMobile) {
      return (
        <SelectItem
          value={href ?? disabledValue}
          disabled={disabled}
          className={cn('min-h-11 whitespace-normal', className)}
        >
          {children}
        </SelectItem>
      );
    }

    const tabClassName = cn(
      'inline-flex h-10 items-center justify-center whitespace-nowrap border-transparent border-b-2 px-0 font-semibold text-sm ring-offset-background transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:border-primary data-[state=active]:text-primary',
      disabled && 'pointer-events-none opacity-50 hover:text-muted-foreground',
      className,
    );

    if (disabled) {
      const { onClick: _onClick, role: _role, ...spanProps } = props;

      return (
        <span
          ref={ref as Ref<HTMLSpanElement>}
          {...spanProps}
          aria-current={active ? 'page' : undefined}
          aria-disabled="true"
          className={tabClassName}
          data-state={active ? 'active' : 'inactive'}
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
        className={tabClassName}
        data-state={active ? 'active' : 'inactive'}
      >
        {children}
      </a>
    );
  },
);
RouteTabLinkAnchor.displayName = 'RouteTabLinkAnchor';

const RouterTabLink = createLink(RouteTabLinkAnchor);

/**
 * A route tab. Takes the router's link options (`to`, `params`, `search`)
 * plus `exact` and `disabled`. A disabled tab has no href, so its active state
 * comes from the router; `exact` is passed on so that follows the same rule.
 */
export const RouteTabLink: LinkComponent<typeof RouteTabLinkAnchor> = (
  props,
) => <RouterTabLink activeOptions={{ exact: props.exact }} {...props} />;

export type RouteTabLinkProps = LinkComponentProps<typeof RouteTabLinkAnchor>;

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
