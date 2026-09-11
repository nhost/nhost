import { EditLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelForm';
import { act, render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
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
    query: { orgSlug: 'test-org', appSubdomain: 'test-app', modelSlug: '' },
    push: vi.fn(),
    asPath:
      '/orgs/test-org/projects/test-app/database/native-queries/default/models/invoice_summary',
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));

vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources',
  () => ({
    useGetSupportedNativeQuerySources: () => mocks.sourcesResult,
  }),
);
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
    mocks.modelsResult.data = [{ name: 'invoice_line_item' }];
    mocks.sourcesResult.data = ['default'];
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
    mocks.router.query.modelSlug = '';
    mocks.router.push.mockReset().mockResolvedValue(true);
  });

  it.each([
    'invoice_summary',
    'another_model',
  ])('navigates after a rename only when editing the routed model (%s)', async (modelSlug) => {
    mocks.router.query.modelSlug = modelSlug;
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} />);
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'renamed_summary');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    if (modelSlug === describedModel.name) {
      await waitFor(() =>
        expect(mocks.router.push).toHaveBeenCalledWith(
          '/orgs/test-org/projects/test-app/database/native-queries/default/models/renamed_summary',
        ),
      );
    } else {
      expect(mocks.router.push).not.toHaveBeenCalled();
    }
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
        source: 'default',
        original: describedModel,
        args: {
          name: describedModel.name,
          description: 'Updated model description',
          fields: describedModel.fields,
        },
      }),
    );
  });

  it('saves fields with omitted nullability as non-nullable without touching their checkboxes', async () => {
    const user = new TestUserEvent();
    const model: LogicalModelItem = {
      ...describedModel,
      fields: [
        { name: 'id', type: { scalar: 'uuid' } },
        {
          name: 'line_items',
          type: { array: { logical_model: 'invoice_line_item' } },
        },
      ],
    };
    render(<EditLogicalModelForm model={model} />);

    for (const name of [
      'Field 1 nullable',
      'Field 2 nullable',
      'Field 2 item nullable',
    ]) {
      expect(screen.getByRole('checkbox', { name })).not.toBeChecked();
    }
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Updated model');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        source: 'default',
        original: model,
        args: {
          name: model.name,
          description: 'Updated model',
          fields: [
            { name: 'id', type: { scalar: 'uuid', nullable: false } },
            {
              name: 'line_items',
              type: {
                array: { logical_model: 'invoice_line_item', nullable: false },
                nullable: false,
              },
            },
          ],
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
        source: 'default',
        original: describedModel,
        args: {
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
        source: 'default',
        original: describedModel,
        args: {
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

  it('keeps a newer same-route draft when an earlier edit response succeeds', async () => {
    const completion = Promise.withResolvers<{ message: string }>();
    mocks.mutateAsync.mockReturnValueOnce(completion.promise);
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<EditLogicalModelForm model={describedModel} onCancel={onCancel} />);

    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Submitted edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Newer draft');

    await act(async () => {
      completion.resolve({ message: 'success' });
      await completion.promise;
    });

    expect(screen.getByLabelText('Description')).toHaveValue('Newer draft');
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('ignores an edit response after the active model is replaced on the same route', async () => {
    const completion = Promise.withResolvers<{ message: string }>();
    mocks.mutateAsync.mockReturnValueOnce(completion.promise);
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    const view = render(
      <EditLogicalModelForm model={describedModel} onCancel={onCancel} />,
    );

    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Submitted edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    view.rerender(
      <EditLogicalModelForm
        model={{ ...describedModel, description: 'Refreshed definition' }}
        onCancel={onCancel}
      />,
    );

    await act(async () => {
      completion.resolve({ message: 'success' });
      await completion.promise;
    });

    expect(screen.getByLabelText('Description')).toHaveValue('Submitted edit');
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
