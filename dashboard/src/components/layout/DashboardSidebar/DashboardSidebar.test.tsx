import { CogIcon, DatabaseIcon, HomeIcon, SparklesIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { mockRouter } from '@/tests/mocks';
import { fireEvent, render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const storageKey = 'dashboard-sidebar-test-collapsed';

function setPath(asPath: string) {
  vi.mocked(useRouter).mockReturnValue({ ...mockRouter, asPath });
}

function renderSidebar() {
  return render(
    <DashboardSidebar
      ariaLabel="Test navigation"
      storageKey={storageKey}
      footer={
        <DashboardSidebar.Item
          label="Settings"
          href="/settings"
          icon={<CogIcon className="size-4" />}
        />
      }
    >
      <DashboardSidebar.Section>
        <DashboardSidebar.Item
          label="Overview"
          href="/overview"
          icon={<HomeIcon className="size-4" />}
          exact
        />
        <DashboardSidebar.Item
          label="AI"
          href="/ai"
          icon={<SparklesIcon className="size-4" />}
        />
      </DashboardSidebar.Section>
      <DashboardSidebar.Section label="Build">
        <DashboardSidebar.Item
          label="Database"
          href="/database"
          icon={<DatabaseIcon className="size-4" />}
          disabled
        />
      </DashboardSidebar.Section>
    </DashboardSidebar>,
  );
}

beforeEach(() => {
  window.localStorage.removeItem(storageKey);
  setPath('/overview');
});

afterEach(() => {
  window.localStorage.removeItem(storageKey);
  vi.clearAllMocks();
});

function renderItem(props: { activePath?: string; exact?: boolean } = {}) {
  return render(
    <DashboardSidebar ariaLabel="Test navigation" storageKey={storageKey}>
      <DashboardSidebar.Section>
        <DashboardSidebar.Item
          label="Destination"
          href="/database/browser/default"
          icon={<DatabaseIcon className="size-4" />}
          {...props}
        />
      </DashboardSidebar.Section>
    </DashboardSidebar>,
  );
}

function expectActive(active: boolean) {
  const link = screen.getByRole('link', { name: 'Destination' });
  if (active) {
    expect(link).toHaveAttribute('aria-current', 'page');
  } else {
    expect(link).not.toHaveAttribute('aria-current');
  }
}

describe('DashboardSidebar.Item active state', () => {
  it.each([
    ['/database/browser/default', true],
    ['/database/browser/default/', true],
    ['/database/browser/default?tab=rows#top', true],
    ['/database/browser/default/public/tables/users', true],
    ['/database/browser/default-old', false],
    ['/database/schema/default', false],
  ])('matches its href and the pages below it on %s', (path, active) => {
    setPath(path);
    renderItem();

    expectActive(active);
  });

  it.each([
    ['/database/browser/default', true],
    ['/database/browser/default?tab=rows', true],
    ['/database/browser/default/public/tables/users', false],
  ])('matches only its href when exact on %s', (path, active) => {
    setPath(path);
    renderItem({ exact: true });

    expectActive(active);
  });

  it.each([
    ['/database', true],
    ['/database/schema/default', true],
    ['/database-old', false],
  ])('matches the path it owns on %s', (path, active) => {
    setPath(path);
    renderItem({ activePath: '/database' });

    expectActive(active);
  });
});

describe('DashboardSidebar', () => {
  it('renders expanded sections, links, footer, and active state', () => {
    renderSidebar();

    expect(
      screen.getByRole('complementary', { name: 'Test navigation' }),
    ).toHaveClass('w-[200px]');
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute(
      'href',
      '/ai',
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('renders disabled items without navigable links', () => {
    renderSidebar();

    expect(screen.queryByRole('link', { name: 'Database' })).toBeNull();
    expect(
      screen.getByText('Database').closest('[aria-disabled="true"]'),
    ).toBeInTheDocument();
  });

  it('collapses to icon-only navigation and persists the state', () => {
    const { unmount } = renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(
      screen.getByRole('complementary', { name: 'Test navigation' }),
    ).toHaveClass('w-[72px]');
    expect(window.localStorage.getItem(storageKey)).toBe('true');
    expect(screen.getByText('Overview')).toHaveClass('sr-only');
    expect(screen.getByText('Build')).toHaveClass('sr-only');
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-pressed', 'true');

    unmount();
    renderSidebar();

    expect(
      screen.getByRole('complementary', { name: 'Test navigation' }),
    ).toHaveClass('w-[72px]');
  });
});
