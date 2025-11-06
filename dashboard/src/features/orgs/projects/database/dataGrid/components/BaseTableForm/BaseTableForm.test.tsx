import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type * as Yup from 'yup';
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
      type: null as any,
      defaultValue: null as any,
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

const user = new TestUserEvent();

async function fillColumnForm(
  { columnName, optionName, typeValue, defaultValue }: any,
  index: number,
) {
  const columnNameInput = screen.getByTestId(`columns.${index}.name`);
  expect(columnNameInput).toBeInTheDocument();
  await user.type(columnNameInput, columnName);

  await TestUserEvent.fireClickEvent(
    screen.getByTestId(`columns.${index}.type`),
  );

  await TestUserEvent.fireClickEvent(
    screen.getByRole('option', { name: optionName }),
  );

  expect(screen.getByDisplayValue(typeValue)).toBeInTheDocument();

  if (defaultValue) {
    expect(
      screen.getByTestId(`columns.${index}.defaultValue`),
    ).toBeInTheDocument();

    TestUserEvent.fireTypeEvent(
      screen.getByTestId(`columns.${index}.defaultValue`),
      `${defaultValue}`,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', {
        name: `Use "${defaultValue}" as a literal`,
      }),
    );

    expect(screen.getByTestId(`columns.${index}.defaultValue`)).toHaveValue(
      defaultValue,
    );
  }
}

describe('BaseTableForm', () => {
  it('should not disable the nullable and unique checkboxes after setting the column name', async () => {
    render(<TestTableFormWrapper />);

    let firstColumnIsNullableCheckbox = screen.getByRole('checkbox', {
      name: (accessibleName, element) =>
        element.getAttribute('name') === 'columns.0.isNullable',
    });

    let firstColumnIsUniqueCheckbox = screen.getByRole('checkbox', {
      name: (accessibleName, element) =>
        element.getAttribute('name') === 'columns.0.isUnique',
    });

    expect(firstColumnIsNullableCheckbox).not.toBeDisabled();
    expect(firstColumnIsUniqueCheckbox).not.toBeDisabled();

    await user.type(screen.getByPlaceholderText('Enter name'), 'column1');
    expect(screen.getByDisplayValue('column1')).toBeInTheDocument();

    firstColumnIsNullableCheckbox = screen.getByRole('checkbox', {
      name: (accessibleName, element) =>
        element.getAttribute('name') === 'columns.0.isNullable',
    });
    firstColumnIsUniqueCheckbox = screen.getByRole('checkbox', {
      name: (accessibleName, element) =>
        element.getAttribute('name') === 'columns.0.isUnique',
    });

    expect(firstColumnIsNullableCheckbox).not.toBeDisabled();
    expect(firstColumnIsUniqueCheckbox).not.toBeDisabled();
  });

  it('should disable the nullable and unique checkboxes if the column is the primary key', async () => {
    render(<TestTableFormWrapper />);
    await fillColumnForm(
      {
        columnName: 'id',
        optionName: 'uuid uuid',
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
    );
    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'note',
        optionName: 'text text',
        typeValue: 'text',
      },
      1,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'isDone',
        optionName: 'boolean bool',
        typeValue: 'boolean',
        defaultValue: 'false',
      },
      2,
    );

    await TestUserEvent.fireClickEvent(screen.getByText('Add Primary Key'));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'id' }),
    );

    expect(screen.getByTestId('id')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: (accessibleName, element) =>
          element.getAttribute('name') === 'columns.0.isNullable',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {
        name: (accessibleName, element) =>
          element.getAttribute('name') === 'columns.0.isUnique',
      }),
    ).toBeDisabled();
  });

  it('should disable the nullable and unique checkboxes and default value if the column is an identity column', async () => {
    render(<TestTableFormWrapper />);
    await fillColumnForm(
      {
        columnName: 'id',
        optionName: 'uuid uuid',
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
    );
    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );

    await fillColumnForm(
      {
        columnName: 'identity_column',
        optionName: 'smallint int2',
        typeValue: 'smallint',
      },
      1,
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

  it.skip('should display the identity column picker if an integer is selected as a column type', async () => {
    render(<TestTableFormWrapper />);

    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await TestUserEvent.fireClickEvent(
      screen.getByPlaceholderText('Select type'),
    );

    await user.type(screen.getByPlaceholderText('Select type'), 'int');

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'smallint int2' }),
    );

    expect(screen.getByDisplayValue('smallint')).toBeInTheDocument();
    expect(screen.getByLabelText('Identity')).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByDisplayValue('smallint'));

    await user.type(screen.getByDisplayValue('smallint'), 'text');

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'text text' }),
    );
    expect(screen.getByDisplayValue('text')).toBeInTheDocument();
    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByDisplayValue('text'));

    await user.type(screen.getByDisplayValue('text'), 'int');

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'integer int4' }),
    );

    expect(screen.getByDisplayValue('integer')).toBeInTheDocument();
    expect(screen.getByLabelText('Identity')).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByDisplayValue('integer'));

    await user.type(screen.getByDisplayValue('integer'), 'numeric');

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'numeric numeric' }),
    );

    expect(screen.getByDisplayValue('numeric')).toBeInTheDocument();
    expect(screen.queryByLabelText('Identity')).not.toBeInTheDocument();

    await TestUserEvent.fireClickEvent(screen.getByDisplayValue('numeric'));
    await user.type(screen.getByDisplayValue('numeric'), 'int');

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'bigint int8' }),
    );

    expect(screen.getByDisplayValue('bigint')).toBeInTheDocument();
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
    expect(screen.getByText('Save')).toBeInTheDocument();

    await user.type(screen.getByTestId('tableNameInput'), 'test_table');

    expect(screen.getByTestId('tableNameInput')).toHaveDisplayValue(
      'test_table',
    );

    await fillColumnForm(
      {
        columnName: 'id',
        optionName: 'uuid uuid',
        typeValue: 'uuid',
        defaultValue: 'gen_random_uuid()',
      },
      0,
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
        optionName: 'text text',
        typeValue: 'text',
      },
      1,
    );

    TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: /Add Column/ }),
    );
    await fillColumnForm(
      {
        columnName: 'identity_column',
        optionName: 'smallint int2',
        typeValue: 'smallint',
      },
      2,
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
        type: { group: 'UUID types', label: 'uuid', value: 'uuid' },
        defaultValue: {
          custom: true,
          dropdownLabel: 'Use "gen_random_uuid()" as a literal',
          label: 'gen_random_uuid()',
          value: 'gen_random_uuid()',
        },
        isNullable: false,
        isUnique: false,
        isIdentity: false,
        comment: 'Test comment',
      },
      {
        name: 'description',
        type: { group: 'String types', label: 'text', value: 'text' },
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
        type: {
          group: 'Numeric types',
          label: 'smallint',
          value: 'int2',
        },
      },
    ]);
  });
});
