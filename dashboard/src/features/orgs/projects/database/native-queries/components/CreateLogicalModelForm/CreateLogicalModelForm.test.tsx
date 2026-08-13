import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm';
import { EditLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  routeChangeStart: undefined as VoidFunction | undefined,
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
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
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
  execPromiseWithErrorToast: async (callback: () => Promise<unknown>) => {
    try {
      return await callback();
    } catch {
      return undefined;
    }
  },
}));

async function fillLogicalModel(user: TestUserEvent, name: string) {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Field 1 name'), 'id');
  await user.click(
    screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
  );
  await user.click(screen.getByRole('option', { name: 'text' }));
}

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

describe('CreateLogicalModelForm', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.modelsResult.data = [];
    mocks.sourcesResult.data = ['default'];
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
    mocks.routeChangeStart = undefined;
    mocks.router.events.on
      .mockReset()
      .mockImplementation((event: string, handler: VoidFunction) => {
        if (event === 'routeChangeStart') {
          mocks.routeChangeStart = handler;
        }
      });
    mocks.router.events.off.mockReset();
    mocks.router.push.mockReset().mockImplementation(async () => {
      mocks.routeChangeStart?.();
      return true;
    });
  });

  it('matches native-query drawer chrome for create and edit forms', () => {
    const { container, rerender } = render(<CreateLogicalModelForm />);

    const expectDrawerChrome = (actionLabel: 'Create' | 'Save') => {
      expect(container.querySelector('form')).toHaveClass('border-t');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const actionButton = screen.getByRole('button', { name: actionLabel });
      const footer = cancelButton.parentElement;

      expect(cancelButton).toHaveClass('text-foreground');
      expect(footer).toHaveClass('grid', 'justify-between', 'border-t', 'p-2');
      expect(footer?.firstElementChild).toBe(cancelButton);
      expect(footer?.lastElementChild).toBe(actionButton);
    };

    expectDrawerChrome('Create');

    rerender(<EditLogicalModelForm model={describedModel} />);

    expectDrawerChrome('Save');
  });

  it('keeps the embedded create form chrome unchanged', () => {
    const { container } = render(
      <CreateLogicalModelForm lockedSource="default" onCreated={vi.fn()} />,
    );

    expect(container.querySelector('form')).not.toHaveClass('border-t');

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const footer = cancelButton.parentElement;

    expect(footer).toHaveClass('flex', 'justify-end', 'border-t', 'pt-4');
    expect(footer).not.toHaveClass('grid', 'p-2');
  });

  it('preserves the standalone logical-model name layout', () => {
    render(<CreateLogicalModelForm />);

    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'placeholder',
      'Logical model name',
    );
    expect(screen.getByLabelText('Name')).toHaveClass('max-w-md');
  });

  it('keeps logical-model actions below a scrollable fields list', () => {
    render(<CreateLogicalModelForm />);

    const scrollableBody = screen
      .getByLabelText('Field 1 name')
      .closest('.overflow-y-auto');
    const footer = screen.getByRole('button', {
      name: 'Create',
    }).parentElement;

    expect(scrollableBody).toHaveClass(
      'relative',
      'min-h-0',
      'flex-1',
      'overflow-y-auto',
    );
    expect(footer).toHaveClass('flex-shrink-0', 'border-t');
    expect(scrollableBody).not.toContainElement(screen.getByLabelText('Name'));
    expect(scrollableBody).not.toContainElement(
      screen.getByRole('button', { name: 'Create' }),
    );
  });

  it('preserves distinct logical-model array nullability controls', async () => {
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm />);

    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');

    const arrayNullable = screen.getByRole('checkbox', {
      name: 'Field 1 nullable',
    });
    const itemsNullable = screen.getByRole('checkbox', {
      name: 'Field 1 item nullable',
    });

    expect(arrayNullable.tagName).toBe('BUTTON');
    expect(itemsNullable.tagName).toBe('BUTTON');
    expect(arrayNullable).not.toBeChecked();
    expect(itemsNullable).not.toBeChecked();

    await user.click(arrayNullable);
    expect(arrayNullable).toBeChecked();
    expect(itemsNullable).not.toBeChecked();
  });

  it('forwards the Cancel click event', async () => {
    const onCancel = vi.fn();
    render(<CreateLogicalModelForm onCancel={onCancel} />);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Cancel' }),
    );

    expect(onCancel).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'click' }),
    );
  });

  it('uses the forward builder for create and keeps entity and field descriptions distinct', async () => {
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm />);

    await user.type(screen.getByLabelText('Name'), 'invoice_summary');
    await user.type(
      screen.getByLabelText('Description'),
      '  Invoice summary model  ',
    );
    await user.type(screen.getByLabelText('Field 1 name'), 'id');
    await user.click(screen.getByRole('button', { name: 'Add description' }));
    await user.type(
      screen.getByLabelText('Field 1 description'),
      '  Primary identifier  ',
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: 'invoice_summary',
          description: 'Invoice summary model',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: false },
              description: 'Primary identifier',
            },
          ],
        },
      }),
    );
  });

  it('clears the standalone dirty source before successful navigation', async () => {
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm />);

    await user.type(screen.getByLabelText('Name'), 'new_result');
    await user.type(screen.getByLabelText('Field 1 name'), 'id');
    await user.click(
      screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledOnce());
    expect(mocks.router.events.on).toHaveBeenCalledWith(
      'routeChangeStart',
      expect.any(Function),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('navigates to a newly created standalone logical model and closes', async () => {
    mocks.sourcesResult.data = ['default', 'analytics'];
    const user = new TestUserEvent();
    const onCancel = vi.fn();
    render(<CreateLogicalModelForm onCancel={onCancel} />);

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await fillLogicalModel(user, 'standalone_result');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledOnce());
    expect(mocks.router.push).toHaveBeenCalledWith(
      '/orgs/test-org/projects/test-app/database/native-queries/analytics/models/standalone_result',
    );
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
  });

  it('closes a cancelled standalone logical model without mutating or navigating', async () => {
    const onCancel = vi.fn();
    render(<CreateLogicalModelForm onCancel={onCancel} />);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Cancel' }),
    );

    expect(onCancel).toHaveBeenCalledOnce();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it('keeps a failed standalone logical model open with its entered values', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('failed'));
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm onCancel={onCancel} />);

    await fillLogicalModel(user, 'failed_result');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('failed_result');
    expect(screen.getByLabelText('Field 1 name')).toHaveValue('id');
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
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
      screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: 'embedded_result',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: false },
            },
          ],
        },
      }),
    );
    expect(onCreated).toHaveBeenCalledWith('embedded_result');
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});
