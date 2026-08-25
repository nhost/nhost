import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { render, screen, within } from '@/tests/testUtils';

describe('RouteTabs', () => {
  it('renders route links with navigation semantics', () => {
    render(
      <RouteTabs aria-label="Database navigation">
        <RouteTabLink href="/database/browser" active>
          Table editor
        </RouteTabLink>
        <RouteTabLink href="/database/schema">Schema</RouteTabLink>
      </RouteTabs>,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Database navigation',
    });
    const activeLink = within(navigation).getByRole('link', {
      name: 'Table editor',
    });
    const inactiveLink = within(navigation).getByRole('link', {
      name: 'Schema',
    });

    expect(activeLink).toHaveAttribute('href', '/database/browser');
    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(activeLink).toHaveAttribute('data-state', 'active');
    expect(inactiveLink).toHaveAttribute('data-state', 'inactive');
    expect(inactiveLink).not.toHaveAttribute('aria-current');
  });

  it('uses the line tabs visual classes', () => {
    render(
      <RouteTabs aria-label="Database navigation">
        <RouteTabLink href="/database/browser">Table editor</RouteTabLink>
      </RouteTabs>,
    );

    expect(screen.getByRole('navigation')).toHaveClass('overflow-x-auto');
    expect(screen.getByText('Table editor').parentElement).toHaveClass(
      'gap-6',
      'text-muted-foreground',
    );
    expect(screen.getByRole('link', { name: 'Table editor' })).toHaveClass(
      'border-b-2',
      'data-[state=active]:border-foreground',
    );
  });

  it('renders separators between tab groups', () => {
    render(
      <RouteTabs aria-label="Database navigation">
        <RouteTabLink href="/database/backups">Backups</RouteTabLink>
        <RouteTabSeparator data-testid="route-tab-separator" />
        <RouteTabLink href="/database/settings">Settings</RouteTabLink>
      </RouteTabs>,
    );

    expect(screen.getByTestId('route-tab-separator')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByTestId('route-tab-separator')).toHaveClass(
      'h-5',
      'w-px',
      'bg-border',
    );
  });

  it('renders disabled tabs without links', () => {
    render(
      <RouteTabs aria-label="Database navigation">
        <RouteTabLink href="/database/backups" disabled>
          Backups
        </RouteTabLink>
      </RouteTabs>,
    );

    expect(
      screen.queryByRole('link', { name: 'Backups' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Backups')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
