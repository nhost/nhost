import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  models: [] as Array<{ name: string }>,
  sources: ['default'] as string[],
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
vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => ({ data: mocks.sources }),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  () => ({ useGetLogicalModels: () => ({ data: mocks.models }) }),
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
    mocks.sources = ['default'];
    mocks.mutateAsync.mockReset().mockResolvedValue({ message: 'success' });
    mocks.router.push.mockReset().mockResolvedValue(true);
  });

  it('builds metadata, navigates, and closes after standalone creation', async () => {
    mocks.sources = ['default', 'analytics'];
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm onCancel={onCancel} />);

    const source = screen.getByRole('combobox', { name: 'Data Source' });
    expect(source).toBeEnabled();
    source.focus();
    await user.keyboard('{Enter}{End}{Enter}');
    await fillForm(user, 'invoice_summary');
    await user.type(
      screen.getByLabelText('Description'),
      '  Invoice summary model  ',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        source: 'analytics',
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
      '/orgs/test-org/projects/test-app/database/native-queries/analytics/models/invoice_summary',
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps embedded creation on its locked source and returns the new name', async () => {
    mocks.sources = ['default', 'analytics'];
    const onCreated = vi.fn();
    const user = new TestUserEvent();
    render(
      <CreateLogicalModelForm lockedSource="analytics" onCreated={onCreated} />,
    );

    expect(
      screen.getByRole('combobox', { name: 'Data Source' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Data Source' }),
    ).toHaveTextContent('analytics');

    await fillForm(user, 'embedded_result');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'analytics' }),
      ),
    );
    expect(onCreated).toHaveBeenCalledWith('embedded_result');
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});
