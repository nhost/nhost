import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  RouteTabLink,
  type RouteTabLinkProps,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { mockRouter } from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

function setPath(asPath: string) {
  vi.mocked(useRouter).mockReturnValue({ ...mockRouter, asPath });
}

function expectActive(active: boolean) {
  const link = screen.getByRole('link', { name: 'Destination' });
  expect(link).toHaveAttribute('data-state', active ? 'active' : 'inactive');
  if (active) {
    expect(link).toHaveAttribute('aria-current', 'page');
  } else {
    expect(link).not.toHaveAttribute('aria-current');
  }
}

function ExampleTabs() {
  return (
    <RouteTabs aria-label="Example navigation" listClassName="gap-4">
      <RouteTabLink href="/database/browser/default">Browser</RouteTabLink>
      <RouteTabLink href="/database/settings" disabled>
        Settings
      </RouteTabLink>
      <RouteTabSeparator data-testid="route-tab-separator" />
      <RouteTabLink href="/database/console/default" exact>
        SQL Console
      </RouteTabLink>
    </RouteTabs>
  );
}

function QueryTabs() {
  return (
    <RouteTabs aria-label="Settings sections">
      <RouteTabLink href="/settings?tab=version">Postgres version</RouteTabLink>
      <RouteTabLink href="/settings?tab=capacity">Capacity</RouteTabLink>
    </RouteTabs>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('RouteTabLink', () => {
  it.each([
    ['/database/backups', true],
    ['/database/backups/', true],
    ['/database/backups?tab=recent#details', true],
    ['/database/backups/point-in-time', true],
    ['/database/backups/import', true],
    ['/database/backups-old', false],
    ['/database/console/default', false],
  ])(
    'uses non-exact segment-boundary matching by default for %s',
    (path, active) => {
      setPath(path);
      render(<RouteTabLink href="/database/backups">Destination</RouteTabLink>);

      expectActive(active);
    },
  );

  it.each([
    ['/database/console/default', true],
    ['/database/console/default/', true],
    ['/database/console/default/?query=123#results', true],
    ['/database/console/default/details', false],
    ['/database/console/default-other', false],
    ['/database/console/analytics', false],
  ])(
    'opts into exact matching with the bare exact prop for %s',
    (path, active) => {
      setPath(path);
      render(
        <RouteTabLink href="/database/console/default" exact>
          Destination
        </RouteTabLink>,
      );

      expectActive(active);
      expect(screen.getByRole('link')).not.toHaveAttribute('exact');
    },
  );

  it('normalizes the destination for matching while preserving its query and hash', () => {
    setPath('/database/backups/?tab=all#details');
    render(
      <RouteTabLink href="/database/backups?tab=all#history" exact>
        Destination
      </RouteTabLink>,
    );

    expectActive(true);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/database/backups?tab=all#history',
    );
  });

  it('normalizes a trailing slash in the supplied href', () => {
    setPath('/database/backups');
    render(
      <RouteTabLink href="/database/backups/" exact>
        Destination
      </RouteTabLink>,
    );

    expectActive(true);
  });

  it('recalculates from the URL on navigation and Back without a parent provider', () => {
    setPath('/database/console/default');
    const { rerender } = render(
      <RouteTabLink href="/database/console/default" exact>
        Destination
      </RouteTabLink>,
    );
    expectActive(true);

    setPath('/database/backups');
    rerender(
      <RouteTabLink href="/database/console/default" exact>
        Destination
      </RouteTabLink>,
    );
    expectActive(false);

    setPath('/database/console/default');
    rerender(
      <RouteTabLink href="/database/console/default" exact>
        Destination
      </RouteTabLink>,
    );
    expectActive(true);
  });

  it('treats a dynamically supplied href just like any other destination', () => {
    setPath('/database/console/analytics');
    const { rerender } = render(
      <RouteTabLink href="/database/console/default" exact>
        Destination
      </RouteTabLink>,
    );
    expectActive(false);

    const source = 'analytics';
    rerender(
      <RouteTabLink href={`/database/console/${source}`} exact>
        Destination
      </RouteTabLink>,
    );
    expectActive(true);
  });

  it('can be active and disabled without exposing a navigable link', () => {
    setPath('/database/backups');
    render(
      <RouteTabLink href="/database/backups" disabled>
        Destination
      </RouteTabLink>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const disabled = screen.getByText('Destination');
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(disabled).toHaveAttribute('aria-current', 'page');
    expect(disabled).not.toHaveAttribute('href');
  });
});

describe('RouteTabs responsive presentation', () => {
  beforeEach(() => {
    mockPointerEvent();
    vi.mocked(useMediaQuery).mockReturnValue(false);
    setPath('/database/browser/default');
    vi.mocked(mockRouter.push).mockResolvedValue(true);
    vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  });

  it.each([false, true])(
    'matches query-based links with desktop=%s',
    (isDesktop) => {
      vi.mocked(useMediaQuery).mockReturnValue(isDesktop);
      setPath('/settings?marker=foo&tab=capacity');
      const { rerender } = render(<QueryTabs />);

      if (isDesktop) {
        expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(
          1,
        );
        expect(screen.getByRole('link', { name: 'Capacity' })).toHaveAttribute(
          'aria-current',
          'page',
        );
      } else {
        expect(screen.getByRole('combobox')).toHaveTextContent('Capacity');
      }

      setPath('/settings?tab=version&marker=foo');
      rerender(<QueryTabs />);
      if (isDesktop) {
        expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(
          1,
        );
        expect(
          screen.getByRole('link', { name: 'Postgres version' }),
        ).toHaveAttribute('aria-current', 'page');
      } else {
        expect(screen.getByRole('combobox')).toHaveTextContent(
          'Postgres version',
        );
      }

      setPath('/settings?tab=unknown');
      rerender(<QueryTabs />);
      if (isDesktop) {
        expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(
          0,
        );
      } else {
        expect(screen.getByRole('combobox')).toHaveTextContent('Navigate');
      }
      expect(mockRouter.push).not.toHaveBeenCalled();
    },
  );

  it('navigates between query-based links with the mobile select', async () => {
    setPath('/settings?tab=capacity');
    const user = new TestUserEvent();
    const { rerender } = render(<QueryTabs />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Capacity' })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(
      screen.getByRole('option', { name: 'Postgres version' }),
    ).toHaveAttribute('data-state', 'unchecked');
    await user.click(screen.getByRole('option', { name: 'Postgres version' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings?tab=version');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Capacity');

    setPath('/settings?tab=version');
    rerender(<QueryTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Postgres version');
  });

  it('keeps desktop links, list styling and separators at md and above', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    render(<ExampleTabs />);

    expect(useMediaQuery).toHaveBeenCalledWith('md');
    expect(
      screen.getByRole('navigation', { name: 'Example navigation' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Browser' }).parentElement,
    ).toHaveClass('gap-4');
    expect(screen.getByTestId('route-tab-separator')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it.each([
    ['/database/browser/default', 'Browser'],
    ['/database/browser/default/public/tables/users?sort=name#rows', 'Browser'],
    ['/database/console/default', 'SQL Console'],
    ['/database/console/default/?query=123#results', 'SQL Console'],
    ['/database/settings', 'Settings'],
  ])(
    'shows the active label on initial load of %s while the select is closed',
    (path, label) => {
      setPath(path);
      render(<ExampleTabs />);

      const trigger = screen.getByRole('combobox', {
        name: 'Example navigation',
      });
      expect(trigger).toHaveTextContent(label);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    },
  );

  it.each([
    '/database/browser/default-other',
    '/database/console/default/details',
    '/unrelated',
  ])('shows the placeholder when no tab matches %s', (path) => {
    setPath(path);
    render(<ExampleTabs />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Navigate');
  });

  it('updates the selected label from route changes and browser Back/Forward', () => {
    const { rerender } = render(<ExampleTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Browser');

    setPath('/database/console/default');
    rerender(<ExampleTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('SQL Console');

    setPath('/database/browser/default/public/tables/users');
    rerender(<ExampleTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Browser');

    setPath('/database/console/default');
    rerender(<ExampleTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('SQL Console');
  });

  it('uses the selected option state and omits mobile separators', async () => {
    const user = new TestUserEvent();
    render(<ExampleTabs />);
    await user.click(screen.getByRole('combobox'));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'Browser' })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.getByRole('option', { name: 'SQL Console' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('route-tab-separator')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps disabled options non-navigable', async () => {
    const user = new TestUserEvent();
    render(<ExampleTabs />);
    await user.click(screen.getByRole('combobox'));

    const settings = screen.getByRole('option', { name: 'Settings' });
    expect(settings).toHaveAttribute('aria-disabled', 'true');
    expect(settings).not.toHaveAttribute('href');
    await TestUserEvent.fireClickEvent(settings);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('navigates on selection and waits for the URL before changing the selected label', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(<ExampleTabs />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'SQL Console' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/database/console/default');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Browser');

    setPath('/database/console/default');
    rerender(<ExampleTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('SQL Console');
  });

  it('preserves the current value when navigation is cancelled', async () => {
    vi.mocked(mockRouter.push).mockResolvedValue(false);
    const user = new TestUserEvent();
    render(<ExampleTabs />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'SQL Console' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/database/console/default');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Browser');

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Browser' })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.getByRole('option', { name: 'SQL Console' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  it('preserves the destination query and hash when navigating', async () => {
    setPath('/unrelated');
    const user = new TestUserEvent();
    const { rerender } = render(
      <RouteTabs aria-label="Example navigation">
        <RouteTabLink href="/database/backups?tab=all#history" exact>
          Backups
        </RouteTabLink>
      </RouteTabs>,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Backups' }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/database/backups?tab=all#history',
    );

    setPath('/database/backups?tab=all#details');
    rerender(
      <RouteTabs aria-label="Example navigation">
        <RouteTabLink href="/database/backups?tab=all#history" exact>
          Backups
        </RouteTabLink>
      </RouteTabs>,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Backups');
  });

  it('supports conditional and array children and clears a removed selection', () => {
    setPath('/database/console/default');
    const { rerender } = render(
      <RouteTabs aria-label="Example navigation">
        {false}
        {null}
        {[
          <RouteTabLink key="browser" href="/database/browser/default">
            Browser
          </RouteTabLink>,
          <RouteTabLink key="console" href="/database/console/default" exact>
            SQL Console
          </RouteTabLink>,
        ]}
      </RouteTabs>,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('SQL Console');

    rerender(
      <RouteTabs aria-label="Example navigation">
        <RouteTabLink href="/database/browser/default">Browser</RouteTabLink>
      </RouteTabs>,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Navigate');
  });

  it('opens with the keyboard, skips disabled options and navigates', async () => {
    const user = new TestUserEvent();
    render(<ExampleTabs />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Browser' })).toHaveFocus(),
    );

    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'SQL Console' })).toHaveFocus(),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(mockRouter.push).toHaveBeenCalledWith('/database/console/default');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
  });

  it('dismisses with Escape and restores focus to the trigger', async () => {
    const user = new TestUserEvent();
    render(<ExampleTabs />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('unmounts an open select and clears its pointer lock when switching to desktop', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(<ExampleTabs />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    vi.mocked(useMediaQuery).mockReturnValue(true);
    rerender(<ExampleTabs />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browser' })).toBeInTheDocument();
    expect(screen.getByTestId('route-tab-separator')).toBeInTheDocument();
    expect(document.body).not.toHaveStyle({ pointerEvents: 'none' });

    vi.mocked(useMediaQuery).mockReturnValue(false);
    rerender(<ExampleTabs />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Browser');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

it('discovers link props without requiring RouteTabLink function identity', () => {
  vi.mocked(useMediaQuery).mockReturnValue(false);
  setPath('/settings?tab=capacity');
  function ForwardedLink(props: RouteTabLinkProps) {
    return <RouteTabLink {...props} />;
  }
  render(
    <RouteTabs aria-label="Forwarded navigation">
      <ForwardedLink href="/settings">Settings</ForwardedLink>
    </RouteTabs>,
  );
  expect(screen.getByRole('combobox')).toHaveTextContent('Settings');
});
