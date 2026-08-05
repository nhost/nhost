import { createElement } from 'react';
import { vi } from 'vitest';
import NativeQueryForm, {
  createNativeQueryFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryForm';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ height }: { height?: string }) =>
    createElement('div', {
      'data-testid': 'sql-editor',
      'data-height': height,
    }),
}));

const valid = {
  source: 'default',
  rootFieldName: 'search_authors',
  description: '  Search authors  ',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [
    { name: 'search', type: 'text', nullable: false, description: '' },
  ],
};

function renderNativeQueryForm(
  argumentValues = valid.arguments,
  originalName?: string,
) {
  const onSubmit = vi.fn();
  const onDirtyChange = vi.fn();
  const result = render(
    createElement(NativeQueryForm, {
      resetToken: 'test',
      values: { ...valid, arguments: argumentValues },
      existingNames: [],
      originalName,
      logicalModelNames: ['author_result'],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit,
      onCancel: vi.fn(),
      onDirtyChange,
    }),
  );

  return { ...result, onSubmit, onDirtyChange };
}

describe('createNativeQueryFormSchema', () => {
  it.each([
    [{ ...valid, rootFieldName: '' }, 'Root field name is required.'],
    [{ ...valid, code: '  ' }, 'SQL is required.'],
    [{ ...valid, returns: '' }, 'Select a return model.'],
  ])('requires the core native query fields', (values, message) => {
    const result = createNativeQueryFormSchema([]).safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(message);
    }
  });

  it('rejects duplicate argument names', () => {
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      arguments: [...valid.arguments, { ...valid.arguments[0] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === 'Argument names must be unique.',
        ),
      ).toBe(true);
    }
  });

  it('rejects collisions but permits an unchanged name while editing', () => {
    expect(
      createNativeQueryFormSchema(['search_authors']).safeParse(valid).success,
    ).toBe(false);
    expect(
      createNativeQueryFormSchema(
        ['search_authors'],
        'search_authors',
      ).safeParse(valid).success,
    ).toBe(true);
  });

  it('requires a stable top-level description string without transforming it', () => {
    expect(
      createNativeQueryFormSchema([]).safeParse({
        ...valid,
        description: undefined,
      }).success,
    ).toBe(false);
    expect(createNativeQueryFormSchema([]).safeParse(valid)).toEqual({
      success: true,
      data: valid,
    });
  });

  it('requires stable argument-description strings without transforming them', () => {
    expect(
      createNativeQueryFormSchema([]).safeParse({
        ...valid,
        arguments: [{ ...valid.arguments[0], description: undefined }],
      }).success,
    ).toBe(false);
    expect(
      createNativeQueryFormSchema([]).safeParse({
        ...valid,
        arguments: [
          { ...valid.arguments[0], description: '  Search phrase  ' },
        ],
      }),
    ).toEqual({
      success: true,
      data: {
        ...valid,
        arguments: [
          { ...valid.arguments[0], description: '  Search phrase  ' },
        ],
      },
    });
  });

  it('renders the optional single-line Description input immediately after the root field name', () => {
    renderNativeQueryForm();

    const rootFieldName = screen.getByLabelText('Root field name');
    const description = screen.getByLabelText('Description');

    expect(description.tagName).toBe('INPUT');
    expect(description).toHaveAttribute(
      'placeholder',
      'Optional native query description',
    );
    expect(description).toHaveValue('  Search authors  ');
    expect(
      rootFieldName.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('lets the arguments section expand while keeping query metadata compact', () => {
    renderNativeQueryForm();

    const dataSourceControl = screen
      .getByLabelText('Data Source')
      .closest('.space-y-2');
    const rootFieldControl = screen
      .getByLabelText('Root field name')
      .closest('.space-y-2');
    const metadataGrid = rootFieldControl?.parentElement;
    const argumentsSection = screen.getByRole('region', {
      name: 'Arguments',
    });

    expect(metadataGrid).toHaveClass('grid', 'sm:grid-cols-2');
    expect(rootFieldControl).toHaveClass('sm:col-span-2');
    expect(screen.getByLabelText('Root field name').parentElement).toHaveClass(
      'sm:max-w-[calc(50%-0.625rem)]',
    );
    expect(dataSourceControl?.nextElementSibling).toBe(rootFieldControl);
    expect(screen.getByTestId('sql-editor')).toHaveAttribute(
      'data-height',
      '180px',
    );
    expect(argumentsSection).toHaveClass('min-h-0', 'flex-1');
  });

  it('retains the correct argument values after removing a middle row', async () => {
    renderNativeQueryForm([
      { name: 'first', type: 'text', nullable: false, description: 'First' },
      { name: 'middle', type: 'uuid', nullable: true, description: 'Middle' },
      { name: 'last', type: 'integer', nullable: false, description: 'Last' },
    ]);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Remove argument 2' }),
    );

    expect(screen.getByLabelText('Argument 1 name')).toHaveValue('first');
    expect(screen.getByLabelText('Argument 2 name')).toHaveValue('last');
    expect(screen.getByLabelText('Argument 2 description')).toHaveValue('Last');
    expect(
      screen.getByRole('combobox', { name: 'Argument 2 type' }),
    ).toHaveTextContent('integer');
    expect(
      screen.queryByRole('combobox', { name: 'Type kind level 0' }),
    ).not.toBeInTheDocument();
    const argumentsSection = screen.getByRole('region', {
      name: 'Arguments',
    });
    const argumentRows = screen
      .getByLabelText('Argument 1 name')
      .closest('fieldset')?.parentElement;
    const saveButton = screen.getByRole('button', { name: 'Create' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const footer = saveButton.parentElement;

    expect(argumentsSection).toHaveAttribute('data-layout', 'contained');
    expect(argumentsSection).toHaveClass(
      'flex',
      'min-h-0',
      'flex-1',
      'flex-col',
    );
    expect(argumentRows).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(saveButton.closest('form')).toHaveClass(
      'box',
      'flex',
      'min-h-0',
      'flex-auto',
      'flex-col',
      'content-between',
      'overflow-hidden',
      'border-t',
    );
    expect(footer).toHaveClass(
      'grid',
      'flex-shrink-0',
      'grid-flow-col',
      'justify-between',
      'gap-3',
      'border-t',
      'p-2',
    );
    expect(footer).toContainElement(cancelButton);
  });

  it('disables pristine edit saves and reports changes and reversions', async () => {
    const { onDirtyChange, unmount } = renderNativeQueryForm(
      valid.arguments,
      valid.rootFieldName,
    );
    const user = new TestUserEvent();
    const description = screen.getByLabelText('Description');
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    await user.clear(description);
    expect(save).toBeEnabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.type(description, valid.description);
    expect(save).toBeDisabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('does not disable Create solely because the form is pristine', () => {
    renderNativeQueryForm();

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('submits successfully with zero arguments', async () => {
    const { onSubmit } = renderNativeQueryForm([]);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Create' }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '  Search authors  ',
          arguments: [],
        }),
        expect.anything(),
      ),
    );
  });
});
