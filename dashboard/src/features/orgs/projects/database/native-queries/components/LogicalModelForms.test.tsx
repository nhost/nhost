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

  it('uses the forward builder for create and keeps entity and field descriptions distinct', async () => {
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm />);

    await user.type(screen.getByLabelText('Name'), '  invoice_summary  ');
    await user.type(
      screen.getByLabelText('Description'),
      '  Invoice summary model  ',
    );
    await user.type(screen.getByLabelText('Field 1 name'), '  id  ');
    await user.type(
      screen.getByLabelText('Field 1 description'),
      '  Primary identifier  ',
    );
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
          description: 'Invoice summary model',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: true },
              description: 'Primary identifier',
            },
          ],
        },
      }),
    );
  });

  it('prefills and updates the entity description independently of field descriptions', async () => {
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} />);

    expect(screen.getByLabelText('Description')).toHaveValue(
      'Existing model description',
    );
    expect(screen.getByLabelText('Field 1 description')).toHaveValue(
      'Existing field description',
    );
    await user.clear(screen.getByLabelText('Description'));
    await user.type(
      screen.getByLabelText('Description'),
      '  Updated model description  ',
    );
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

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
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

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

    await user.clear(screen.getByLabelText('Field 1 description'));
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

  it('omits whitespace descriptions in the locked embedded create flow', async () => {
    const onCreated = vi.fn();
    const user = new TestUserEvent();
    render(
      <CreateLogicalModelForm lockedSource="default" onCreated={onCreated} />,
    );

    expect(
      screen.getByRole('combobox', { name: 'Data Source' }),
    ).toBeDisabled();
    await user.type(screen.getByLabelText('Name'), 'embedded_result');
    await user.type(screen.getByLabelText('Description'), '   ');
    await user.type(screen.getByLabelText('Field 1 name'), 'id');
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
          name: 'embedded_result',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: true },
            },
          ],
        },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith('embedded_result');
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});
