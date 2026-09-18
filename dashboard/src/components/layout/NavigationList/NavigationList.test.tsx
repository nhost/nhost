import { CogIcon, DatabaseIcon, HomeIcon, SparklesIcon } from 'lucide-react';
import { NavigationList } from '@/components/layout/NavigationList';
import { render, screen } from '@/tests/testUtils';

function renderNav() {
  return render(
    <NavigationList
      ariaLabel="Test navigation"
      footer={
        <NavigationList.Item
          label="Settings"
          href="/settings"
          icon={<CogIcon className="size-4" />}
        />
      }
    >
      <NavigationList.Section>
        <NavigationList.Item
          label="Overview"
          href="/overview"
          icon={<HomeIcon className="size-4" />}
          active
        />
        <NavigationList.Item
          label="AI"
          href="/ai"
          icon={<SparklesIcon className="size-4" />}
        />
      </NavigationList.Section>
      <NavigationList.Section label="Build">
        <NavigationList.Item
          label="Database"
          href="/database"
          icon={<DatabaseIcon className="size-4" />}
          disabled
        />
      </NavigationList.Section>
    </NavigationList>,
  );
}

describe('NavigationList', () => {
  it('renders expanded sections, links, footer, and active state', () => {
    renderNav();

    expect(
      screen.getByRole('navigation', { name: 'Test navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Build')).not.toHaveClass('sr-only');
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
    renderNav();

    expect(screen.queryByRole('link', { name: 'Database' })).toBeNull();
    expect(
      screen.getByText('Database').closest('[aria-disabled="true"]'),
    ).toBeInTheDocument();
  });
});
