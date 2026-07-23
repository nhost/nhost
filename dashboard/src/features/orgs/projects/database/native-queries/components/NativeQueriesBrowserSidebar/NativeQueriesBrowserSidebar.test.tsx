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
  nativeQueryMutateAsync: vi.fn(),
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
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="SQL editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
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
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.nativeQueryMutateAsync,
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
    mocks.nativeQueryMutateAsync.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('lists queries before models and sorts each kind by name', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    const authorCollection = await screen.findByText('author_collection');
    const authorResult = screen.getByText('author_result');
    const searchAuthors = screen.getByText('search_authors');
    expect(
      searchAuthors.compareDocumentPosition(authorCollection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      authorCollection.compareDocumentPosition(authorResult) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.type(
      screen.getByPlaceholderText('Search models and queries...'),
      'search',
    );
    expect(screen.getByText('search_authors')).toBeInTheDocument();
    expect(screen.queryByText('author_result')).not.toBeInTheDocument();

    await user.clear(
      screen.getByPlaceholderText('Search models and queries...'),
    );
    await user.type(
      screen.getByPlaceholderText('Search models and queries...'),
      'collection',
    );
    expect(screen.getByText('author_collection')).toBeInTheDocument();
    expect(screen.queryByText('search_authors')).not.toBeInTheDocument();
  });

  it('offers logical model creation', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(
      screen.getByRole('menuitem', { name: 'Native query' }),
    ).not.toHaveAttribute('data-disabled');

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

  it('opens native query creation and submits the form', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.click(screen.getByRole('menuitem', { name: 'Native query' }));
    expect(screen.getByText('Create native query')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Root field name'), {
      target: { value: 'search_authors' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save native query' })
        .closest('form')!,
    );
    expect(
      await screen.findByText(
        'A native query with this root field name already exists.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('SQL is required.')).toBeInTheDocument();
    expect(mocks.nativeQueryMutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Root field name'), {
      target: { value: 'list_authors' },
    });
    fireEvent.change(screen.getByLabelText('SQL editor'), {
      target: { value: 'SELECT * FROM authors' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save native query' })
        .closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          root_field_name: 'list_authors',
          type: 'query',
          arguments: {},
          code: 'SELECT * FROM authors',
          returns: 'author_result',
        },
      }),
    );
  });

  it('opens edit and delete flows for native queries', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit native query' }),
    );
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save native query' })
        .closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          original: expect.objectContaining({
            root_field_name: 'search_authors',
          }),
          args: expect.objectContaining({ root_field_name: 'search_authors' }),
        }),
      ),
    );

    mocks.nativeQueryMutateAsync.mockClear();
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete native query' }),
    );
    expect(screen.getByText('Delete native query?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith({
        original: expect.objectContaining({
          root_field_name: 'search_authors',
        }),
      }),
    );
  });

  it('confirms deletion from the logical model item menu', async () => {
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
