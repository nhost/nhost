import { CogIcon, DatabaseIcon, HomeIcon, SparklesIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { NavigationList } from '@/components/layout/NavigationList';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

function setPath(asPath: string) {
  vi.mocked(useRouter).mockReturnValue({ ...mockRouter, asPath });
}

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
          exact
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

beforeEach(() => {
  setPath('/overview');
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderItem(props: { activePath?: string; exact?: boolean } = {}) {
  return render(
    <NavigationList ariaLabel="Test navigation">
      <NavigationList.Section>
        <NavigationList.Item
          label="Destination"
          href="/database/browser/default"
          icon={<DatabaseIcon className="size-4" />}
          {...props}
        />
      </NavigationList.Section>
    </NavigationList>,
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

describe('NavigationList.Item active state', () => {
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
