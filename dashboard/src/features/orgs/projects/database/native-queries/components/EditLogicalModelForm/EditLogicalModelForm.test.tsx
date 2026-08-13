import { EditLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelForm';
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
}));

vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => mocks.sourcesResult,
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  () => ({ useGetLogicalModels: () => mocks.modelsResult }),
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

describe('EditLogicalModelForm', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    mocks.modelsResult.data = [];
    mocks.sourcesResult.data = ['default'];
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
  });

  it('prefills and updates the entity description independently of field descriptions', async () => {
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} />);

    expect(screen.getByLabelText('Description')).toHaveValue(
      'Existing model description',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Field 1 nullable' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Field 1 item nullable' }),
    ).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Edit description' }),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Description'));
    await user.type(
      screen.getByLabelText('Description'),
      '  Updated model description  ',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: describedModel,
        args: {
          source: 'default',
          name: describedModel.name,
          description: 'Updated model description',
          fields: describedModel.fields,
        },
      }),
    );
  });

  it('omits a cleared entity description without clearing the field description', async () => {
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} />);

    await user.clear(screen.getByLabelText('Description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: describedModel,
        args: {
          source: 'default',
          name: describedModel.name,
          fields: describedModel.fields,
        },
      }),
    );
  });

  it('omits a cleared field description without clearing the entity description', async () => {
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} />);

    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    await user.clear(screen.getByLabelText('Field 1 description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: describedModel,
        args: {
          source: 'default',
          name: describedModel.name,
          description: describedModel.description,
          fields: [
            {
              name: 'line_items',
              type: describedModel.fields[0]?.type,
            },
          ],
        },
      }),
    );
  });
});
