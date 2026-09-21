import { HomeIcon } from 'lucide-react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { NavigationList } from '@/components/layout/NavigationList';
import { fireEvent, render, screen } from '@/tests/testUtils';

const storageKey = 'dashboard-sidebar-test-collapsed';

function renderSidebar() {
  return render(
    <DashboardSidebar storageKey={storageKey}>
      <NavigationList ariaLabel="Test navigation">
        <NavigationList.Section label="Build">
          <NavigationList.Item
            label="Overview"
            href="/overview"
            icon={<HomeIcon className="size-4" />}
            active
          />
        </NavigationList.Section>
      </NavigationList>
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
  it('renders the navigation expanded by default', () => {
    renderSidebar();

    expect(screen.getByRole('complementary')).toHaveClass('w-[200px]');
    expect(screen.getByText('Overview')).not.toHaveClass('sr-only');
  });

  it('collapses to icon-only navigation and persists the state', () => {
    const { unmount } = renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('complementary')).toHaveClass('w-[72px]');
    expect(window.localStorage.getItem(storageKey)).toBe('true');
    expect(screen.getByText('Overview')).toHaveClass('sr-only');
    expect(screen.getByText('Build')).toHaveClass('sr-only');
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-pressed', 'true');

    unmount();
    renderSidebar();

    expect(screen.getByRole('complementary')).toHaveClass('w-[72px]');
  });
});
