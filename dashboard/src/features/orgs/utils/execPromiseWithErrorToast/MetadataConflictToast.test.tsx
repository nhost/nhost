import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { mockMatchMediaValue } from '@/tests/mocks';
import { queryClient, render, screen, TestUserEvent } from '@/tests/testUtils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import MetadataConflictToast from './MetadataConflictToast';

const mocks = vi.hoisted(() => ({ useProject: vi.fn() }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const METADATA_URL = 'https://local.hasura.local.nhost.run/v1/metadata';
const TOAST_ID = 'metadata-conflict';

const project = {
  id: 'project-id',
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const freshMetadata: ExportMetadataResponse = {
  resource_version: 71,
  metadata: { version: 3, sources: [] },
};

const server = setupServer();

function renderConflictToast() {
  render(
    <MetadataConflictToast
      toastId={TOAST_ID}
      error={
        new Error(
          'metadata resource version referenced (70) did not match current version',
        )
      }
    />,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  toast.remove();
  server.resetHandlers();
  queryClient.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('MetadataConflictToast', () => {
  it('shows a success toast after fetching the latest metadata', async () => {
    mocks.useProject.mockReturnValue({ project, loading: false });
    server.use(http.post(METADATA_URL, () => HttpResponse.json(freshMetadata)));
    const dismissSpy = vi.spyOn(toast, 'dismiss');
    const user = new TestUserEvent();
    renderConflictToast();

    await user.click(screen.getByRole('button', { name: 'Fetch metadata' }));

    expect(
      await screen.findByText('Metadata fetched successfully.'),
    ).toBeInTheDocument();
    expect(dismissSpy).toHaveBeenCalledWith(TOAST_ID);
  });

  it('shows an error when fetching the metadata fails', async () => {
    mocks.useProject.mockReturnValue({ project, loading: false });
    server.use(
      http.post(METADATA_URL, () =>
        HttpResponse.json({ error: 'Export failed' }, { status: 500 }),
      ),
    );
    const dismissSpy = vi.spyOn(toast, 'dismiss');
    const user = new TestUserEvent();
    renderConflictToast();

    await user.click(screen.getByRole('button', { name: 'Fetch metadata' }));

    expect(
      await screen.findByRole('heading', { name: 'Couldn’t fetch metadata' }),
    ).toBeInTheDocument();
    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it('disables fetching when there is no project', () => {
    mocks.useProject.mockReturnValue({ project: null, loading: false });
    renderConflictToast();

    expect(
      screen.getByRole('button', { name: 'Fetch metadata' }),
    ).toBeDisabled();
  });
});
