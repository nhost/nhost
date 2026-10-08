import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  models: [] as Array<{ name: string }>,
  mutateAsync: vi.fn(),
  router: {
    asPath: '/orgs/test-org/projects/test-app/database/native-queries/default',
    query: {
      orgSlug: 'test-org',
      appSubdomain: 'test-app',
    },
    push: vi.fn(),
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useExportMetadata', () => ({
  EXPORT_METADATA_QUERY_KEY: 'export-metadata',
  useExportMetadata: () => ({
    refetch: async () => ({
      data: {
        resource_version: 1,
        metadata: {
          version: 3,
          sources: ['default'].map((name) => ({
            name,
            kind: 'postgres',
            tables: [],
            native_queries: [],
            logical_models: mocks.models,
          })),
        },
      },
    }),
  }),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useGetLogicalModels: () => ({ data: mocks.models }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    useLogicalModelMetadataMutation: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  }),
);

async function fillForm(user: TestUserEvent, name: string) {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Field 1 name'), 'id');
  await user.click(
    screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
  );
  await user.click(screen.getByRole('option', { name: 'uuid' }));
}

describe('CreateLogicalModelForm', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.models = [];
    mocks.mutateAsync.mockReset().mockResolvedValue({ message: 'success' });
    mocks.router.push.mockReset().mockResolvedValue(true);
  });

  it('builds metadata, navigates, and closes after standalone creation', async () => {
    const onSubmit = vi.fn();
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm onSubmit={onSubmit} />);

    await fillForm(user, 'invoice_summary');
    await user.type(
      screen.getByLabelText('Description'),
      '  Invoice summary model  ',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          name: 'invoice_summary',
          description: 'Invoice summary model',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: false },
            },
          ],
        },
      }),
    );
    expect(mocks.router.push).toHaveBeenCalledWith(
      '/orgs/test-org/projects/test-app/database/native-queries/default/models/invoice_summary',
    );
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('returns the new name without navigating when embedded', async () => {
    const onCreated = vi.fn();
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm onCreated={onCreated} />);

    await fillForm(user, 'embedded_result');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ name: 'embedded_result' }),
        }),
      ),
    );
    expect(onCreated).toHaveBeenCalledWith('embedded_result');
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});
