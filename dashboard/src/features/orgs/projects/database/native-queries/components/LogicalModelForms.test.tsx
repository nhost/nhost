import { vi } from 'vitest';
import {
  CreateLogicalModelForm,
  EditLogicalModelForm,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  modelsResult: {
    data: [] as Array<{ name: string }>,
  },
  sourcesResult: {
    data: ['default'] as string[],
  },
  mutateAsync: vi.fn(),
  router: {
    query: {
      orgSlug: 'test-org',
      appSubdomain: 'test-app',
    },
    push: vi.fn(),
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => mocks.sourcesResult,
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  () => ({ default: () => mocks.modelsResult }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  }),
);
vi.mock('@/features/orgs/utils/execPromiseWithErrorToast', () => ({
  execPromiseWithErrorToast: async (callback: () => Promise<unknown>) =>
    callback(),
}));

const describedModel: LogicalModelItem = {
  name: 'invoice_summary',
  description: 'Existing model description',
  fields: [
    {
      name: 'line_items',
      description: 'Existing field description',
      type: {
        array: {
          logical_model: 'invoice_line_item',
          nullable: true,
        },
        nullable: false,
      },
    },
  ],
};

describe('LogicalModelForms', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mocks.modelsResult.data = [];
    mocks.sourcesResult.data = ['default'];
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
    mocks.router.push.mockReset();
    mocks.router.push.mockResolvedValue(true);
  });

  it('uses the forward builder for create and omits blank descriptions', async () => {
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm />);

    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), '  invoice_summary  ');
    await user.type(screen.getByLabelText('Field 1 name'), '  id  ');
    await user.click(
      screen.getByRole('combobox', { name: 'Scalar type level 0' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: 'invoice_summary',
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

  it('prefills and forwards existing descriptions while controls remain hidden', async () => {
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} />);

    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: describedModel,
        args: {
          source: 'default',
          name: describedModel.name,
          description: describedModel.description,
          fields: describedModel.fields,
        },
      }),
    );
  });
});
