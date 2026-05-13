import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type * as Yup from 'yup';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
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
}));

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
      <BaseTableForm onSubmit={mocks.onSubmit} submitButtonText="Save" />
    </FormProvider>
  );
}

async function pickAutocompleteOption(
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
  { columnName, optionName, typeValue, defaultValue, defaultValueKind }: any,
  index: number,
  user: TestUserEvent,
) {
  const columnNameInput = screen.getByTestId(`columns.${index}.name`);
  expect(columnNameInput).toBeInTheDocument();
  await user.type(columnNameInput, columnName);

  await pickAutocompleteOption(
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
    expect(
      screen.getByTestId(`columns.${index}.defaultValue`),
    ).toBeInTheDocument();

    const kind = defaultValueKind ?? 'literal';
    await pickAutocompleteOption(
      `columns.${index}.defaultValue`,
      'Search functions...',
      kind === 'function' ? defaultValue : `Use '${defaultValue}' as a literal`,
      defaultValue,
      user,
    );

    expect(
      screen.getByTestId(`columns.${index}.defaultValue`),
    ).toHaveTextContent(defaultValue);
  }
}

describe('BaseTableForm', () => {
  beforeEach(() => {
    mocks.onSubmit.mockClear();
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
        defaultValueKind: 'function',
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
        defaultValueKind: 'function',
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

    await pickAutocompleteOption(
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

    await pickAutocompleteOption(
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

    await pickAutocompleteOption(
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

    await pickAutocompleteOption(
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

    await pickAutocompleteOption(
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

    await pickAutocompleteOption(
      'columns.0.type',
      'Search types...',
      /^text.*text/,
      'text',
      user,
    );

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await pickAutocompleteOption(
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
        defaultValueKind: 'function',
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
        defaultValue: { value: 'gen_random_uuid()', custom: false },
        isNullable: false,
        isUnique: false,
        isIdentity: false,
        comment: 'Test comment',
      },
      {
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
        isIdentity: false,
        isNullable: false,
        isUnique: false,
        name: 'identity_column',
        type: 'int2',
      },
    ]);
  });

  it('should submit a colliding default as a literal when the user picks the create item', async () => {
    render(<TestTableFormWrapper />);

    const user = new TestUserEvent();

    await user.type(screen.getByTestId('tableNameInput'), 'test_table');

    await fillColumnForm(
      {
        columnName: 'note',
        optionName: /^text.*text/,
        typeValue: 'text',
        defaultValue: 'version()',
        defaultValueKind: 'literal',
      },
      0,
      user,
    );

    await TestUserEvent.fireClickEvent(screen.getByText('Save'));

    expect(mocks.onSubmit.mock.calls[0][0].columns[0].defaultValue).toEqual({
      value: 'version()',
      custom: true,
    });
  });
});
