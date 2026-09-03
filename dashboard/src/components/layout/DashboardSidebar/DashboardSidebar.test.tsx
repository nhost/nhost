import { CogIcon, DatabaseIcon, HomeIcon, SparklesIcon } from 'lucide-react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { fireEvent, render, screen } from '@/tests/testUtils';

const storageKey = 'dashboard-sidebar-test-collapsed';

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
          active
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
});

afterEach(() => {
  window.localStorage.removeItem(storageKey);
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
