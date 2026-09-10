import { useRouter } from 'next/router';
import { vi } from 'vitest';
import BackupsSidebar from '@/features/orgs/projects/backups/components/BackupsSidebar/BackupsSidebar';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

afterEach(() => {
  vi.clearAllMocks();
});

it('wires the three project destinations and matches Scheduled backups exactly', () => {
  const backupsPath = '/orgs/nhost/projects/dashboard/database/backups';
  const route =
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups/point-in-time';
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: route,
    route,
    asPath: `${backupsPath}/point-in-time`,
    query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
  });
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);

  render(<BackupsSidebar />);

  const scheduled = screen.getByRole('link', { name: 'Scheduled backups' });
  const pointInTime = screen.getByRole('link', { name: 'Point-in-Time' });
  const importBackup = screen.getByRole('link', { name: 'Import backup' });

  expect(screen.getAllByRole('link')).toHaveLength(3);
  expect(scheduled).toHaveAttribute('href', backupsPath);
  expect(pointInTime).toHaveAttribute('href', `${backupsPath}/point-in-time`);
  expect(importBackup).toHaveAttribute('href', `${backupsPath}/import`);
  expect(scheduled).not.toHaveAttribute('aria-current');
  expect(pointInTime).toHaveAttribute('aria-current', 'page');
});
