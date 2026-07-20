import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type * as Yup from 'yup';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import BaseTableForm, {
  type BaseTableFormValues,
  baseTableValidationSchema,
} from './BaseTableForm';

mockPointerEvent();

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: vi.fn(() => ({
    width: 100,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 100,
  })),
});

const mocks = vi.hoisted(() => ({
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
}));

const validationBaseValues = {
  name: 'test_table',
  columns: [
    { name: 'alpha', type: 'text', formReference: 'column-alpha' },
    { name: 'beta', type: 'text', formReference: 'column-beta' },
  ],
  foreignKeyRelations: [],
  primaryKeyIndices: [],
  identityColumnIndex: null,
};

const defaultFormValues = {
  columns: [
    {
      name: '',
      type: null,
      defaultValue: null,
      isNullable: false,
      isUnique: false,
      isIdentity: false,
      comment: '',
    },
  ],
  foreignKeyRelations: [],
  primaryKeyIndices: [],
  identityColumnIndex: null,
};

// biome-ignore lint/suspicious/noExplicitAny: test file
function TestTableFormWrapper({ defaultValues = defaultFormValues }: any) {
  const form = useForm<
    BaseTableFormValues | Yup.InferType<typeof baseTableValidationSchema>
  >({
    defaultValues,
    shouldUnregister: false,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseTableValidationSchema),
  });

  return (
    <FormProvider {...form}>
      <BaseTableForm
        onSubmit={mocks.onSubmit}
        onCancel={mocks.onCancel}
        submitButtonText="Save"
      />
    </FormProvider>
  );
}

async function pickComboboxOption(
  triggerTestId: string,
  searchPlaceholder: string,
  optionName: RegExp | string,
  searchTerm: string,
  user: TestUserEvent,
) {
  await user.click(screen.getByTestId(triggerTestId));
  const searchInput = screen.getByPlaceholderText(searchPlaceholder);
  if (searchTerm) {
    await user.type(searchInput, searchTerm);
  }
  await user.click(screen.getByRole('option', { name: optionName }));
}

async function fillColumnForm(
  // biome-ignore lint/suspicious/noExplicitAny: test file
  { columnName, optionName, typeValue, defaultValue }: any,
  index: number,
  user: TestUserEvent,
) {
  const columnNameInput = screen.getByTestId(`columns.${index}.name`);
  expect(columnNameInput).toBeInTheDocument();
  await user.type(columnNameInput, columnName);

  await pickComboboxOption(
    `columns.${index}.type`,
    'Search types...',
    optionName,
    '',
    user,
  );

  expect(screen.getByTestId(`columns.${index}.type`)).toHaveTextContent(
    typeValue,
  );

  if (defaultValue) {
    const defaultValueInput = screen.getByTestId(
      `columns.${index}.defaultValue`,
    );
    expect(defaultValueInput).toBeInTheDocument();

    await user.type(defaultValueInput, defaultValue);

    expect(defaultValueInput).toHaveValue(defaultValue);
  }
}

describe('baseTableValidationSchema UNIQUE constraint parity', () => {
  it.each([
    {
      description: 'an omitted optional name',
      constraints: [
        { id: 'one', columnReferences: ['column-alpha'] },
      ],
      expected: true,
    },
    {
      description: 'an empty optional name',
      constraints: [
        { id: 'one', name: '', columnReferences: ['column-alpha'] },
      ],
      expected: true,
    },
    {
      description: 'whitespace for a new optional name',
      constraints: [
        { id: 'one', name: '   ', columnReferences: ['column-alpha'] },
      ],
      expected: true,
    },
    {
      description: 'an unchanged legacy name',
      constraints: [
        {
          id: 'one',
          originalName: 'legacy-name',
          name: 'legacy-name',
          columnReferences: ['column-alpha'],
        },
      ],
      expected: true,
    },
    {
      description: 'an empty loaded name',
      constraints: [
        {
          id: 'one',
          originalName: 'loaded_name',
          name: '',
          columnReferences: ['column-alpha'],
        },
      ],
      expected: false,
    },
    {
      description: 'a whitespace-only loaded name',
      constraints: [
        {
          id: 'one',
          originalName: 'loaded_name',
          name: '   ',
          columnReferences: ['column-alpha'],
        },
      ],
      expected: false,
    },
    {
      description: 'a name starting with a number',
      constraints: [
        { id: 'one', name: '1invalid', columnReferences: ['column-alpha'] },
      ],
      expected: false,
    },
    {
      description: 'a name containing invalid syntax',
      constraints: [
        { id: 'one', name: 'invalid-name', columnReferences: ['column-alpha'] },
      ],
      expected: false,
    },
    {
      description: 'a name over the PostgreSQL identifier limit',
      constraints: [
        { id: 'one', name: 'a'.repeat(64), columnReferences: ['column-alpha'] },
      ],
      expected: false,
    },
    {
      description: 'duplicate supplied names after whitespace inspection',
      constraints: [
        { id: 'one', name: 'same', columnReferences: ['column-alpha'] },
        { id: 'two', name: ' same ', columnReferences: ['column-beta'] },
      ],
      expected: false,
    },
    {
      description: 'case-distinct supplied names',
      constraints: [
        { id: 'one', name: 'Same', columnReferences: ['column-alpha'] },
        { id: 'two', name: 'same', columnReferences: ['column-beta'] },
      ],
      expected: true,
    },
    {
      description: 'zero references',
      constraints: [{ id: 'one', name: '', columnReferences: [] }],
      expected: false,
    },
    {
      description: 'duplicate references',
      constraints: [
        {
          id: 'one',
          name: '',
          columnReferences: ['column-alpha', 'column-alpha'],
        },
      ],
      expected: false,
    },
    {
      description: 'a missing reference',
      constraints: [
        { id: 'one', name: '', columnReferences: ['missing-column'] },
      ],
      expected: false,
    },
    {
      description: 'duplicate ordered column sets',
      constraints: [
        {
          id: 'one',
          name: 'first',
          columnReferences: ['column-alpha', 'column-beta'],
        },
        {
          id: 'two',
          name: 'second',
          columnReferences: ['column-alpha', 'column-beta'],
        },
      ],
      expected: true,
    },
  ])(
    'acceptance is $expected for $description',
    async ({ constraints, expected }) => {
      await expect(
        baseTableValidationSchema.isValid({
          ...validationBaseValues,
          uniqueConstraints: constraints,
        }),
      ).resolves.toBe(expected);
    },
  );
});

describe('BaseTableForm', () => {
  beforeEach(() => {
    mocks.onSubmit.mockClear();
    mocks.onCancel.mockClear();
  });

  it('should not disable the nullable and unique checkboxes after setting the column name', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    expect(screen.getByTestId('columns.0.isNullable')).not.toBeDisabled();
    expect(screen.getByTestId('columns.0.isUnique')).not.toBeDisabled();

    await user.type(screen.getByPlaceholderText('Enter name'), 'column1');
    expect(screen.getByDisplayValue('column1')).toBeInTheDocument();

    expect(screen.getByTestId('columns.0.isNullable')).not.toBeDisabled();
    expect(screen.getByTestId('columns.0.isUnique')).not.toBeDisabled();
  });

  it('should disable the nullable and unique checkboxes if the column is the primary key', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    await fillColumnForm(
      {
        columnName: 'id',
        optionName: /^uuid.*uuid/,
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
      user,
    );
    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'note',
        optionName: /^text.*text/,
        typeValue: 'text',
      },
      1,
      user,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'isDone',
        optionName: /^boolean.*bool/,
        typeValue: 'boolean',
        defaultValue: 'false',
      },
      2,
      user,
    );

    await TestUserEvent.fireClickEvent(screen.getByText('Add Primary Key'));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'id' }),
    );

    expect(screen.getByTestId('id')).toBeInTheDocument();
    expect(screen.getByTestId('columns.0.isNullable')).toBeDisabled();
    expect(screen.getByTestId('columns.0.isUnique')).toBeDisabled();
  });

  it('should disable the nullable and unique checkboxes and default value if the column is an identity column', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    await fillColumnForm(
      {
        columnName: 'id',
        optionName: /^uuid.*uuid/,
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
      user,
    );
    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'identity_column',
        optionName: /^smallint.*int2/,
        typeValue: 'smallint',
      },
      1,
      user,
    );

    TestUserEvent.fireClickEvent(screen.getByLabelText('Identity'));
    expect(
      screen.getByRole('option', { name: 'identity_column' }),
    ).toBeInTheDocument();
    TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'identity_column' }),
    );

    expect(screen.getByRole('combobox', { name: 'Identity' }).textContent).toBe(
      'identity_column',
    );
  });

  it('should display identity column picker when smallint is selected', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^smallint.*int2/,
      'int',
      user,
    );

    expect(screen.getByTestId('columns.0.type')).toHaveTextContent('smallint');
    expect(screen.getByLabelText('Identity')).toBeInTheDocument();
  });

  it('should display identity column picker when integer is selected', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^integer.*int4/,
      'int',
      user,
    );

    expect(screen.getByTestId('columns.0.type')).toHaveTextContent('integer');
    expect(screen.getByLabelText('Identity')).toBeInTheDocument();
  });

  it('should display identity column picker when bigint is selected', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^bigint.*int8/,
      'int',
      user,
    );

    expect(screen.getByTestId('columns.0.type')).toHaveTextContent('bigint');
    expect(screen.getByLabelText('Identity')).toBeInTheDocument();
  });

  it('should not display identity column picker when text type is selected', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^text.*text/,
      'text',
      user,
    );

    expect(screen.getByTestId('columns.0.type')).toHaveTextContent('text');
    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();
  });

  it('should not display identity column picker when numeric type is selected', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^numeric.*numeric/,
      'numeric',
      user,
    );

    expect(screen.getByTestId('columns.0.type')).toHaveTextContent('numeric');
    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();
  });

  it('should show identity picker when changing from text to integer type', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^text.*text/,
      'text',
      user,
    );

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickComboboxOption(
      'columns.0.type',
      'Search types...',
      /^integer.*int4/,
      'int',
      user,
    );

    expect(screen.getByTestId('columns.0.type')).toHaveTextContent('integer');
    expect(screen.getByLabelText('Identity')).toBeInTheDocument();
  });

  it('should add a new empty row with the Add Column button', async () => {
    render(<TestTableFormWrapper />);
    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    expect(screen.getAllByPlaceholderText('Enter name')).toHaveLength(2);

    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );
    expect(screen.getAllByPlaceholderText('Enter name')).toHaveLength(4);
  });

  it('the remove column button is disabled if it is the only column', async () => {
    render(<TestTableFormWrapper />);
    expect(screen.getByTestId('remove-column-0')).toBeDisabled();
    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    expect(screen.getByTestId('remove-column-0')).not.toBeDisabled();
    expect(screen.getByTestId('remove-column-1')).not.toBeDisabled();
    expect(screen.getByTestId('remove-column-2')).not.toBeDisabled();

    TestUserEvent.fireClickEvent(screen.getByTestId('remove-column-1'));
    expect(screen.getByTestId('remove-column-0')).not.toBeDisabled();
    expect(screen.getByTestId('remove-column-1')).not.toBeDisabled();

    TestUserEvent.fireClickEvent(screen.getByTestId('remove-column-1'));

    expect(screen.getByTestId('remove-column-0')).toBeDisabled();
  });

  it('should add a comment to the column', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    expect(screen.getByText('Save')).toBeInTheDocument();

    await user.type(screen.getByTestId('tableNameInput'), 'test_table');

    expect(screen.getByTestId('tableNameInput')).toHaveDisplayValue(
      'test_table',
    );

    await fillColumnForm(
      {
        columnName: 'id',
        optionName: /^uuid.*uuid/,
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
      user,
    );

    await TestUserEvent.fireClickEvent(screen.getByTestId('columns.0.comment'));
    expect(
      screen.getByPlaceholderText('Add a comment for the column'),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('Add a comment for the column'),
      'Test comment{Escape}',
    );

    expect(
      screen.queryByPlaceholderText('Add a comment for the column'),
    ).not.toBeInTheDocument();

    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'description',
        optionName: /^text.*text/,
        typeValue: 'text',
      },
      1,
      user,
    );

    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );
    await fillColumnForm(
      {
        columnName: 'identity_column',
        optionName: /^smallint.*int2/,
        typeValue: 'smallint',
      },
      2,
      user,
    );

    await TestUserEvent.fireClickEvent(screen.getByText('Add Primary Key'));

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'id' }),
    );

    expect(screen.getByTestId('id')).toBeInTheDocument();

    TestUserEvent.fireClickEvent(screen.getByLabelText('Identity'));
    expect(
      screen.getByRole('option', { name: 'identity_column' }),
    ).toBeInTheDocument();
    TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'identity_column' }),
    );

    expect(screen.getByText('Save')).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(screen.getByText('Save')).not.toBeDisabled();

    expect(mocks.onSubmit.mock.calls[0][0].name).toBe('test_table');
    expect(mocks.onSubmit.mock.calls[0][0].primaryKeyIndices).toStrictEqual([
      '0',
    ]);
    expect(mocks.onSubmit.mock.calls[0][0].identityColumnIndex).toBe(2);
    expect(mocks.onSubmit.mock.calls[0][0].columns).toStrictEqual([
      {
        name: 'id',
        type: 'uuid',
        defaultValue: 'gen_random_uuid()',
        isNullable: false,
        isUnique: false,
        isIdentity: false,
        comment: 'Test comment',
      },
      {
        formReference: expect.any(String),
        name: 'description',
        type: 'text',
        defaultValue: null,
        isNullable: false,
        isUnique: false,
        isIdentity: false,
        comment: null,
      },
      {
        comment: null,
        defaultValue: null,
        formReference: expect.any(String),
        isIdentity: false,
        isNullable: false,
        isUnique: false,
        name: 'identity_column',
        type: 'int2',
      },
    ]);
  });

  it('creates a canonical singleton constraint from the Unique shortcut', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-name',
              name: 'name',
              type: 'text',
              isNullable: false,
              isUnique: false,
            },
          ],
          uniqueConstraints: [],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('columns.0.isUnique'),
    );
    expect(screen.getByText('test_table_name_key')).toBeVisible();
    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit.mock.calls[0][0].uniqueConstraints).toEqual([
      {
        id: expect.any(String),
        columnReferences: ['column-name'],
      },
    ]);
  });

  it('derives the Unique checkbox state from a dialog-created singleton', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-name',
              name: 'name',
              type: 'text',
              isNullable: false,
              isUnique: false,
            },
          ],
          uniqueConstraints: [],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await TestUserEvent.fireClickEvent(screen.getByText('Select columns'));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'name' }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add' }),
    );

    expect(screen.getByTestId('columns.0.isUnique')).toBeChecked();
    expect(screen.getByText('test_table_name_key')).toBeVisible();
    expect(mocks.onSubmit).not.toHaveBeenCalled();
  });

  it('preserves UNIQUE constraint multiselect insertion order', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-name',
              name: 'name',
              type: 'text',
            },
            {
              formReference: 'column-tenant',
              name: 'tenant_id',
              type: 'uuid',
            },
          ],
          uniqueConstraints: [],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await TestUserEvent.fireClickEvent(screen.getByText('Select columns'));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'tenant_id' }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'name' }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add' }),
    );
    expect(await screen.findByText('tenant_id, name')).toBeVisible();
    expect(mocks.onSubmit).not.toHaveBeenCalled();

    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit.mock.calls[0][0].uniqueConstraints).toEqual([
      expect.objectContaining({
        columnReferences: ['column-tenant', 'column-name'],
      }),
    ]);
  });

  it('submits duplicate UNIQUE column sets with generated names and stable ordered references after a column rename', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-alpha',
              name: 'alpha',
              type: 'text',
            },
            {
              formReference: 'column-beta',
              name: 'beta',
              type: 'text',
            },
          ],
          uniqueConstraints: [],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    const user = new TestUserEvent();
    for (const name of ['', 'duplicate_key']) {
      await user.click(
        screen.getByRole('button', { name: 'Add Unique Constraint' }),
      );
      if (name) {
        await user.type(screen.getByLabelText('Name (optional)'), name);
      }
      await user.click(screen.getByText('Select columns'));
      await user.click(screen.getByRole('option', { name: 'beta' }));
      await user.click(screen.getByRole('option', { name: 'alpha' }));
      await TestUserEvent.fireClickEvent(
        screen.getByRole('button', { name: 'Add' }),
      );
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    }

    const alphaName = screen.getByTestId('columns.0.name');
    await user.clear(alphaName);
    await user.type(alphaName, 'renamed_alpha');

    expect(
      screen.queryByRole('button', { name: 'Move unique column up' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove unique column' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Unique constraint name'),
    ).not.toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit).toHaveBeenCalledTimes(1);
    expect(mocks.onSubmit.mock.calls[0][0].uniqueConstraints).toEqual([
      {
        id: expect.any(String),
        name: '',
        columnReferences: ['column-beta', 'column-alpha'],
      },
      {
        id: expect.any(String),
        name: 'duplicate_key',
        columnReferences: ['column-beta', 'column-alpha'],
      },
    ]);
    expect(mocks.onSubmit.mock.calls[0][0].columns[0]).toEqual(
      expect.objectContaining({
        formReference: 'column-alpha',
        name: 'renamed_alpha',
      }),
    );
  });

  it('submits a loaded UNIQUE rename without changing its domain identity or ordered references', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-alpha',
              name: 'alpha',
              type: 'text',
            },
            {
              formReference: 'column-beta',
              name: 'beta',
              type: 'text',
            },
          ],
          uniqueConstraints: [
            {
              id: 'loaded-domain-id',
              originalName: 'loaded_key',
              name: 'loaded_key',
              columnReferences: ['column-beta', 'column-alpha'],
            },
          ],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    const user = new TestUserEvent();
    await user.click(
      screen.getByRole('button', {
        name: 'Edit unique constraint loaded_key',
      }),
    );
    const nameInput = screen.getByPlaceholderText(
      'test_table_beta_alpha_key',
    );
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed_key');
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(mocks.onSubmit).toHaveBeenCalledTimes(1);
    expect(mocks.onSubmit.mock.calls[0][0].uniqueConstraints).toEqual([
      {
        id: 'loaded-domain-id',
        originalName: 'loaded_key',
        name: 'renamed_key',
        columnReferences: ['column-beta', 'column-alpha'],
      },
    ]);
  });

  it('confirms removal of all singleton constraints without removing a composite', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-name',
              name: 'name',
              type: 'text',
              isNullable: false,
              isUnique: true,
            },
            {
              formReference: 'column-tenant',
              name: 'tenant_id',
              type: 'uuid',
              isNullable: false,
              isUnique: false,
            },
          ],
          uniqueConstraints: [
            {
              id: 'singleton-one',
              originalName: 'name_key',
              name: 'name_key',
              columnReferences: ['column-name'],
            },
            {
              id: 'singleton-two',
              originalName: 'name_key_two',
              name: 'name_key_two',
              columnReferences: ['column-name'],
            },
            {
              id: 'composite',
              originalName: 'tenant_name_key',
              name: 'tenant_name_key',
              columnReferences: ['column-tenant', 'column-name'],
            },
          ],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Move unique column up' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Move unique column down' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove unique column' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Add Column' }),
    ).toHaveLength(1);

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('columns.0.isUnique'),
    );
    expect(screen.getByText(/all 2 singleton UNIQUE constraints/)).toBeVisible();
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /^Remove$/ }),
    );
    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit.mock.calls[0][0].uniqueConstraints).toEqual([
      expect.objectContaining({
        id: 'composite',
        columnReferences: ['column-tenant', 'column-name'],
      }),
    ]);
  });

  it('keeps a constraint visibly invalid when a referenced column is removed', async () => {
    render(
      <TestTableFormWrapper
        defaultValues={{
          name: 'test_table',
          columns: [
            {
              formReference: 'column-name',
              name: 'name',
              type: 'text',
            },
            {
              formReference: 'column-tenant',
              name: 'tenant_id',
              type: 'uuid',
            },
          ],
          uniqueConstraints: [
            {
              id: 'composite',
              originalName: 'tenant_name_key',
              name: 'tenant_name_key',
              columnReferences: ['column-tenant', 'column-name'],
            },
          ],
          foreignKeyRelations: [],
          primaryKeyIndices: [],
          identityColumnIndex: null,
        }}
      />,
    );

    await TestUserEvent.fireClickEvent(screen.getByTestId('remove-column-1'));
    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Every UNIQUE constraint must have a valid name/),
    ).toBeVisible();
    expect(
      screen.getByText('Missing column (column-tenant), name'),
    ).toBeVisible();

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', {
        name: 'Edit unique constraint tenant_name_key',
      }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('combobox', { name: 'Columns' }),
    );
    expect(
      screen.getByRole('option', {
        name: 'Missing column (column-tenant)',
      }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('should not call onSubmit when the Cancel button is clicked, even with a valid form', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    await user.type(screen.getByTestId('tableNameInput'), 'test_table');

    await fillColumnForm(
      {
        columnName: 'id',
        optionName: /^uuid.*uuid/,
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
      user,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    // Without type="button", the button defaults to type="submit" inside the
    // <form> and clicking Cancel would submit the form.
    expect(cancelButton).toHaveAttribute('type', 'button');

    await TestUserEvent.fireClickEvent(cancelButton);

    expect(mocks.onSubmit).not.toHaveBeenCalled();
    expect(mocks.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel without triggering form submission on an untouched form', async () => {
    render(<TestTableFormWrapper />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    // Without type="button", the button defaults to type="submit" inside the
    // <form> and clicking Cancel would submit the form.
    expect(cancelButton).toHaveAttribute('type', 'button');

    await TestUserEvent.fireClickEvent(cancelButton);

    expect(mocks.onSubmit).not.toHaveBeenCalled();
    expect(mocks.onCancel).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('This field is required.'),
    ).not.toBeInTheDocument();
  });

  it('should show an error when the table name exceeds 63 characters', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    await user.type(screen.getByTestId('tableNameInput'), 'a'.repeat(64));

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(
      await screen.findByText('Table name must be at most 63 characters.'),
    ).toBeInTheDocument();
    expect(mocks.onSubmit).not.toHaveBeenCalled();
  });

  it('should show an error when a column name exceeds 63 characters', async () => {
    render(<TestTableFormWrapper />);
    const user = new TestUserEvent();

    await user.type(screen.getByTestId('tableNameInput'), 'valid_table');
    await user.type(screen.getByTestId('columns.0.name'), 'a'.repeat(64));

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(
      await screen.findByText('Column name must be at most 63 characters.'),
    ).toBeInTheDocument();
    expect(mocks.onSubmit).not.toHaveBeenCalled();
  });

  it('should submit a quoted literal verbatim, even when it collides with a function name', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    await user.type(screen.getByTestId('tableNameInput'), 'test_table');

    await fillColumnForm(
      {
        columnName: 'note',
        optionName: /^text.*text/,
        typeValue: 'text',
        defaultValue: "'version()'",
      },
      0,
      user,
    );

    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit.mock.calls[0][0].columns[0].defaultValue).toBe(
      "'version()'",
    );
  });

  it('should submit an empty-string literal default verbatim', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    await user.type(screen.getByTestId('tableNameInput'), 'test_table');

    await fillColumnForm(
      {
        columnName: 'note',
        optionName: /^text.*text/,
        typeValue: 'text',
        defaultValue: "''",
      },
      0,
      user,
    );

    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit.mock.calls[0][0].columns[0].defaultValue).toBe("''");
  });
});
