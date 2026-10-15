import {
  createLink,
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
  useContext,
  useId,
} from 'react';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  SidebarItemAnchor,
  type SidebarItemAnchorProps,
  SidebarSectionTitle,
} from '@/components/layout/Sidebar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { isRouteActive, useCurrentHref } from '@/lib/route-navigation';
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
      child.type === AreaSidebarLink
    ) {
      return [child];
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      return getSidebarLinks(child.props.children);
    }
    return [];
  });
}

function MobileAreaSidebar({
  ariaLabel,
  children,
}: Pick<AreaSidebarNavProps, 'ariaLabel' | 'children'>) {
  const router = useRouter();
  const currentHref = useCurrentHref();
  // The links' select values are the hrefs they build (see
  // AreaSidebarLinkAnchor), so they can be compared with the current one.
  const links = getSidebarLinks(children).map((link) => ({
    link,
    href: router.buildLocation(link.props).href,
  }));
  const activeLink = links.find(({ link, href }) =>
    isRouteActive(currentHref, href, link.props.exact),
  );

  return (
    <Select
      value={activeLink?.href ?? ''}
      onValueChange={(value) => {
        const selected = links.find(({ href }) => href === value);
        if (!selected || selected.link.props.disabled) {
          return;
        }
        void router.navigate({
          href: selected.href,
          replace: selected.link.props.replace,
          resetScroll: selected.link.props.resetScroll,
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
            : 'min-w-0 px-5',
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

interface AreaSidebarLinkAnchorProps
  extends Omit<SidebarItemAnchorProps, 'activePath'> {
  itemClassName?: string;
}

const AreaSidebarLinkAnchor = forwardRef<
  HTMLElement,
  AreaSidebarLinkAnchorProps
>(
  (
    {
      children,
      className,
      disabled,
      exact = false,
      href,
      itemClassName,
      ...props
    },
    ref,
  ) => {
    const isMobile = useContext(AreaSidebarPresentationContext) === 'mobile';
    // A disabled link has no href; it only needs a unique select value.
    const disabledValue = useId();

    if (isMobile) {
      return (
        <SelectItem
          value={href ?? disabledValue}
          disabled={disabled}
          className={cn('min-h-11 whitespace-normal', className, itemClassName)}
        >
          {children}
        </SelectItem>
      );
    }

    return (
      <li className={className}>
        <SidebarItemAnchor
          ref={ref}
          href={href}
          exact={exact}
          disabled={disabled}
          className={itemClassName}
          {...props}
        >
          {children}
        </SidebarItemAnchor>
      </li>
    );
  },
);
AreaSidebarLinkAnchor.displayName = 'AreaSidebarLinkAnchor';

/**
 * A link in an area sidebar. Takes the router's link options (`to`,
 * `params`, `search`) plus `exact`, `disabled` and `itemClassName`.
 */
export const AreaSidebarLink = createLink(AreaSidebarLinkAnchor);

type AreaSidebarLinkProps = LinkComponentProps<typeof AreaSidebarLinkAnchor>;
