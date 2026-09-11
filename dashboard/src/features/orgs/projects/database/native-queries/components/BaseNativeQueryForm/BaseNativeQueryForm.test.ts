import { createElement } from 'react';
import {
  BaseNativeQueryForm,
  createNativeQueryFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm';
import { buildNativeQueryDTO } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ height, value }: { height?: string; value?: string }) =>
    createElement('div', {
      'data-testid': 'sql-editor',
      'data-height': height,
      'data-value': value,
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

const validIdentifierCases = ['name', 'name123', '_leading'];
const invalidIdentifierCases = [
  ['', 'is required.'],
  [' ', 'must start with a letter or underscore.'],
  [' name', 'must start with a letter or underscore.'],
  ['name ', 'must contain only letters, numbers, or underscores.'],
  ['my-name!', 'must contain only letters, numbers, or underscores.'],
  ['1name', 'must start with a letter or underscore.'],
] as const;

function renderNativeQueryForm(
  argumentValues = valid.arguments,
  originalName?: string,
) {
  const onSubmit = vi.fn();
  const onDirtyChange = vi.fn();
  const result = render(
    createElement(BaseNativeQueryForm, {
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

  it.each(
    validIdentifierCases,
  )('passes the valid root field name %j through to track args unchanged', (rootFieldName) => {
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      rootFieldName,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(buildNativeQueryDTO(result.data).args.root_field_name).toBe(
        rootFieldName,
      );
    }
  });

  it.each(
    validIdentifierCases,
  )('passes the valid argument name %j through to track args unchanged', (name) => {
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      arguments: [{ ...valid.arguments[0], name }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(buildNativeQueryDTO(result.data).args.arguments).toHaveProperty(
        name,
      );
    }
  });

  it.each(
    invalidIdentifierCases,
  )('rejects invalid root field name %j before building track args', (rootFieldName, message) => {
    const builder = vi.fn(buildNativeQueryDTO);
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      rootFieldName,
    });

    if (result.success) {
      builder(result.data);
    }
    expect(result.success).toBe(false);
    expect(builder).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['rootFieldName'],
          message: `Root field name ${message}`,
        }),
      );
    }
  });

  it.each(
    invalidIdentifierCases,
  )('rejects invalid argument name %j before building track args', (name, message) => {
    const builder = vi.fn(buildNativeQueryDTO);
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      arguments: [{ ...valid.arguments[0], name }],
    });

    if (result.success) {
      builder(result.data);
    }
    expect(result.success).toBe(false);
    expect(builder).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['arguments', 0, 'name'],
          message: `Argument name ${message}`,
        }),
      );
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

    expect(dataSourceControl?.nextElementSibling).toBe(rootFieldControl);
    expect(screen.getByTestId('sql-editor')).toHaveAttribute(
      'data-height',
      '180px',
    );
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
    await new TestUserEvent().click(
      screen.getByTestId('arguments.1.description'),
    );
    expect(screen.getByLabelText('Argument 2 description')).toHaveValue('Last');
    expect(
      screen.getByRole('combobox', { name: 'Argument 2 type' }),
    ).toHaveTextContent('integer');
    expect(
      screen.queryByRole('combobox', { name: /Field \d+ kind/ }),
    ).not.toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: 'Create' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    expect(saveButton.parentElement).toContainElement(cancelButton);
  });

  it('associates an argument type error with the exact re-indexed trigger', async () => {
    renderNativeQueryForm([
      { name: 'search', type: '', nullable: false, description: '' },
    ]);
    const user = new TestUserEvent();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    const error = await screen.findByText('Select or enter an argument type.');
    const trigger = screen.getByRole('combobox', {
      name: 'Argument 1 type',
    });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute(
      'aria-describedby',
      'native-query-argument-1-type-error',
    );
    expect(trigger).toHaveAccessibleDescription(
      'Select or enter an argument type.',
    );
    expect(error).toHaveAttribute('id', 'native-query-argument-1-type-error');
  });

  it('preserves a description across popover closes without dirtying on open', async () => {
    renderNativeQueryForm(valid.arguments, valid.rootFieldName);
    const user = new TestUserEvent();
    const save = screen.getByRole('button', { name: 'Save' });
    const addTrigger = screen.getByRole('button', {
      name: 'Add description',
    });

    expect(save).toBeDisabled();
    await user.click(addTrigger);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(addTrigger).toHaveFocus());
    expect(save).toBeDisabled();

    await user.click(addTrigger);
    await user.type(
      screen.getByLabelText('Argument 1 description'),
      'Search phrase',
    );
    await user.keyboard('{Escape}');
    const editTrigger = await screen.findByRole('button', {
      name: 'Edit description',
    });
    await user.click(editTrigger);
    expect(screen.getByLabelText('Argument 1 description')).toHaveValue(
      'Search phrase',
    );
    expect(save).toBeEnabled();
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

  it('rejects unavailable sources and source-local return models', () => {
    const result = createNativeQueryFormSchema(
      [],
      undefined,
      ['analytics'],
      ['analytics_result'],
    ).safeParse({
      ...valid,
      source: 'missing',
      returns: 'author_result',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['source'] }),
          expect.objectContaining({ path: ['returns'] }),
        ]),
      );
    }
  });

  it('clears returns on source change while preserving the rest of the draft', async () => {
    const onSubmit = vi.fn();
    const onSourceChange = vi.fn();
    render(
      createElement(BaseNativeQueryForm, {
        values: valid,
        existingNames: [],
        logicalModelNames: ['author_result', 'analytics_result'],
        sourceOptions: ['default', 'analytics'],
        isPending: false,
        onSubmit,
        onCancel: vi.fn(),
        onSourceChange,
      }),
    );
    const user = new TestUserEvent();

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');

    expect(onSourceChange).toHaveBeenCalledWith('analytics');
    expect(screen.getByLabelText('Root field name')).toHaveValue(
      'search_authors',
    );
    expect(screen.getByLabelText('Description')).toHaveValue(
      '  Search authors  ',
    );
    expect(screen.getByTestId('sql-editor')).toHaveAttribute(
      'data-value',
      'SELECT * FROM authors',
    );
    expect(screen.getByLabelText('Argument 1 name')).toHaveValue('search');
    expect(
      screen.getByRole('checkbox', { name: 'Argument 1 nullable' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveTextContent('Select a logical model');

    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.click(screen.getByRole('option', { name: 'analytics_result' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'analytics',
          rootFieldName: 'search_authors',
          description: '  Search authors  ',
          returns: 'analytics_result',
          code: 'SELECT * FROM authors',
          arguments: valid.arguments,
        }),
        expect.anything(),
      ),
    );
  });

  it('revalidates source and return membership after options refresh', async () => {
    const baseProps = {
      values: valid,
      existingNames: [] as string[],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(
      createElement(BaseNativeQueryForm, {
        ...baseProps,
        logicalModelNames: ['author_result'],
      }),
    );

    rerender(
      createElement(BaseNativeQueryForm, {
        ...baseProps,
        sourceOptions: [],
        logicalModelNames: [],
      }),
    );

    expect(
      await screen.findByText('The selected data source is unavailable.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('The selected logical model is unavailable.'),
    ).toBeInTheDocument();
  });

  it('locks the source while a mutation is pending', () => {
    render(
      createElement(BaseNativeQueryForm, {
        values: valid,
        existingNames: [],
        logicalModelNames: ['author_result'],
        sourceOptions: ['default', 'analytics'],
        isPending: true,
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(
      screen.getByRole('combobox', { name: 'Data Source' }),
    ).toBeDisabled();
  });
});
