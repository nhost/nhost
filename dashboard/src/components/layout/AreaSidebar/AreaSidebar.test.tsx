import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { mockRouter } from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

function ExampleSidebar() {
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Example navigation">
        <AreaSidebarLink href="/overview">Overview</AreaSidebarLink>
        <AreaSidebarGroup label="Settings">
          <AreaSidebarLink href="/settings?tab=general" shallow>
            General
          </AreaSidebarLink>
          <AreaSidebarLink href="/settings?tab=advanced" replace shallow>
            Advanced
          </AreaSidebarLink>
          <AreaSidebarLink href="/settings?tab=restricted" disabled>
            Restricted
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

function setPath(asPath: string) {
  vi.mocked(useRouter).mockReturnValue({ ...mockRouter, asPath });
}

beforeEach(() => {
  mockPointerEvent();
  vi.mocked(useMediaQuery).mockReturnValue(true);
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  vi.mocked(mockRouter.push).mockResolvedValue(true);
  vi.mocked(mockRouter.replace).mockResolvedValue(true);
  setPath('/overview');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AreaSidebar', () => {
  it('renders desktop links and the same grouped items as mobile options', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(<ExampleSidebar />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['Overview', 'General', 'Advanced'],
    );
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    vi.mocked(useMediaQuery).mockReturnValue(false);
    rerender(<ExampleSidebar />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('combobox', { name: 'Example navigation' }),
    );

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Overview', 'General', 'Advanced', 'Restricted']);
    expect(
      within(screen.getByRole('group', { name: 'Settings' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['General', 'Advanced', 'Restricted']);
  });

  it('derives desktop and mobile selection from the URL, including query-only changes', async () => {
    const user = new TestUserEvent();
    setPath('/settings?tab=general');
    const { rerender } = render(<ExampleSidebar />);
    expect(screen.getAllByRole('link', { current: 'page' })).toEqual([
      screen.getByRole('link', { name: 'General' }),
    ]);

    setPath('/settings?tab=advanced');
    rerender(<ExampleSidebar />);
    expect(screen.getAllByRole('link', { current: 'page' })).toEqual([
      screen.getByRole('link', { name: 'Advanced' }),
    ]);

    vi.mocked(useMediaQuery).mockReturnValue(false);
    rerender(<ExampleSidebar />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Advanced');

    setPath('/settings?tab=general');
    rerender(<ExampleSidebar />);
    expect(screen.getByRole('combobox')).toHaveTextContent('General');
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'General' })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.getByRole('option', { name: 'Advanced' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  it('navigates from mobile options using each link’s destination and navigation options', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    const user = new TestUserEvent();
    render(<ExampleSidebar />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'General' }));
    expect(mockRouter.push).toHaveBeenCalledExactlyOnceWith(
      '/settings?tab=general',
      undefined,
      { shallow: true, scroll: undefined, locale: undefined },
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Advanced' }));
    expect(mockRouter.replace).toHaveBeenCalledExactlyOnceWith(
      '/settings?tab=advanced',
      undefined,
      { shallow: true, scroll: undefined, locale: undefined },
    );
    expect(mockRouter.push).toHaveBeenCalledOnce();
  });

  it('prevents disabled items from navigating on desktop and mobile', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(<ExampleSidebar />);
    expect(
      screen.queryByRole('link', { name: 'Restricted' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Restricted')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByText('Restricted'));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    vi.mocked(useMediaQuery).mockReturnValue(false);
    rerender(<ExampleSidebar />);
    await user.click(screen.getByRole('combobox'));
    const option = screen.getByRole('option', { name: 'Restricted' });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    await user.click(option);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
