import { act } from 'react';
import { toast } from 'react-hot-toast';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import NativeQueriesBrowserSidebar from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesBrowserSidebar';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import {
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  router: {
    asPath:
      '/orgs/test/projects/local/database/native-queries/default/models/author_result',
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      modelSlug: 'author_result',
    },
    events: { on: vi.fn(), off: vi.fn() },
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    loading: false,
    project: {
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

const server = setupServer(hasuraMetadataQuery);

describe('NativeQueriesBrowserSidebar', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('lists logical models from metadata in name order and filters them', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    const authorCollection = await screen.findByText('author_collection');
    const authorResult = screen.getByText('author_result');
    expect(
      authorCollection.compareDocumentPosition(authorResult) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.type(
      screen.getByPlaceholderText('Search models and queries...'),
      'collection',
    );
    expect(screen.getByText('author_collection')).toBeInTheDocument();
    expect(screen.queryByText('author_result')).not.toBeInTheDocument();
  });

  it('offers logical model creation and keeps native query creation disabled', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(
      screen.getByRole('menuitem', { name: /Native query/ }),
    ).toHaveAttribute('data-disabled');

    await user.click(screen.getByRole('menuitem', { name: 'Logical model' }));
    expect(screen.getByText('Create logical model')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'author_result' },
    });
    fireEvent.change(screen.getByLabelText('Field 1 name'), {
      target: { value: 'id' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save logical model' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('A logical model with this name already exists.'),
    ).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'new_result' },
    });
    await user.click(
      screen.getByRole('combobox', { name: 'Scalar type level 0' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save logical model' })
        .closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: 'new_result',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: true },
            },
          ],
        },
      }),
    );
  });

  it('opens edit from the item menu and submits the existing model', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit logical model' }),
    );
    expect(screen.getByText(/Edit/)).toBeInTheDocument();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save logical model' })
        .closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ name: 'author_result' }),
        }),
      ),
    );
  });

  it('confirms deletion from the item menu', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete logical model' }),
    );
    expect(screen.getByText('Delete logical model?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: expect.objectContaining({ name: 'author_result' }),
      }),
    );
  });
});
