import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import StorageMaintenanceButton from './StorageMaintenanceButton';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const STORAGE_BASE = 'https://local.storage.local.nhost.run/v1';

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

const server = setupServer(tokenQuery);

describe('StorageMaintenanceButton', () => {
  const user = new TestUserEvent();

  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useProject.mockReturnValue({
      project: {
        id: 'test-project',
        config: { hasura: { adminSecret: 'secret' } },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  describe('singular/plural copy', () => {
    it('should use singular "file" and "entry" when counts are 1', async () => {
      server.use(
        http.post(`${STORAGE_BASE}/ops/list-orphans`, () =>
          HttpResponse.json({ files: [{ id: 'orphan-1' }] }),
        ),
        http.post(`${STORAGE_BASE}/ops/list-broken-metadata`, () =>
          HttpResponse.json({ metadata: [{ id: 'broken-1' }] }),
        ),
      );

      render(<StorageMaintenanceButton />);
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('1 orphaned file found.')).toBeInTheDocument();
        expect(
          screen.getByText('1 broken metadata entry found.'),
        ).toBeInTheDocument();
      });
    });

    it('should use plural "files" and "entries" when counts are > 1', async () => {
      server.use(
        http.post(`${STORAGE_BASE}/ops/list-orphans`, () =>
          HttpResponse.json({
            files: [{ id: 'o-1' }, { id: 'o-2' }, { id: 'o-3' }],
          }),
        ),
        http.post(`${STORAGE_BASE}/ops/list-broken-metadata`, () =>
          HttpResponse.json({
            metadata: [{ id: 'b-1' }, { id: 'b-2' }],
          }),
        ),
      );

      render(<StorageMaintenanceButton />);
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('3 orphaned files found.')).toBeInTheDocument();
        expect(
          screen.getByText('2 broken metadata entries found.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('delete actions', () => {
    it('should call deleteOrphans then refetch both lists', async () => {
      const callOrder: string[] = [];

      server.use(
        http.post(`${STORAGE_BASE}/ops/list-orphans`, () => {
          callOrder.push('list-orphans');
          return HttpResponse.json({ files: [{ id: 'o-1' }] });
        }),
        http.post(`${STORAGE_BASE}/ops/list-broken-metadata`, () => {
          callOrder.push('list-broken-metadata');
          return HttpResponse.json({ metadata: [] });
        }),
        http.post(`${STORAGE_BASE}/ops/delete-orphans`, () => {
          callOrder.push('delete-orphans');
          return HttpResponse.json({ files: [] });
        }),
      );

      render(<StorageMaintenanceButton />);
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('1 orphaned file found.')).toBeInTheDocument();
      });

      callOrder.length = 0;

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(callOrder).toContain('delete-orphans');
        expect(callOrder).toContain('list-orphans');
        expect(callOrder).toContain('list-broken-metadata');
        expect(callOrder.indexOf('delete-orphans')).toBeLessThan(
          callOrder.indexOf('list-orphans'),
        );
      });
    });

    it('should call deleteBroken then refetch both lists', async () => {
      const callOrder: string[] = [];

      server.use(
        http.post(`${STORAGE_BASE}/ops/list-orphans`, () => {
          callOrder.push('list-orphans');
          return HttpResponse.json({ files: [] });
        }),
        http.post(`${STORAGE_BASE}/ops/list-broken-metadata`, () => {
          callOrder.push('list-broken-metadata');
          return HttpResponse.json({ metadata: [{ id: 'b-1' }] });
        }),
        http.post(`${STORAGE_BASE}/ops/delete-broken-metadata`, () => {
          callOrder.push('delete-broken-metadata');
          return HttpResponse.json({ metadata: [] });
        }),
      );

      render(<StorageMaintenanceButton />);
      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(
          screen.getByText('1 broken metadata entry found.'),
        ).toBeInTheDocument();
      });

      callOrder.length = 0;

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(callOrder).toContain('delete-broken-metadata');
        expect(callOrder).toContain('list-orphans');
        expect(callOrder).toContain('list-broken-metadata');
        expect(callOrder.indexOf('delete-broken-metadata')).toBeLessThan(
          callOrder.indexOf('list-orphans'),
        );
      });
    });
  });
});
