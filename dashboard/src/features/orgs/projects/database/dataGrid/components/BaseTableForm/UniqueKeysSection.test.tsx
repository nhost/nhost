import { FormProvider, useForm } from 'react-hook-form';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import type { BaseTableFormValues } from './BaseTableForm';
import { UniqueCheckbox } from './ColumnEditorRow/UniqueCheckbox';
import UniqueKeysSection from './UniqueKeysSection';

mockScrollIntoViewAndPointerCapture();

const defaultValues: Partial<BaseTableFormValues> = {
  columns: [
    { id: 'tenant_id', name: 'tenant_id', type: 'uuid' },
    { id: 'order_id', name: 'order_id', type: 'uuid' },
    { id: 'sku', name: 'sku', type: 'text' },
  ],
  primaryKeyIndices: [],
  identityColumnIndex: null,
  uniqueKeys: [
    { name: 'orders_tenant_id_order_id_key', columnIndices: ['0', '1'] },
    { name: 'orders_order_id_sku_key', columnIndices: ['1', '2'] },
  ],
};

function TestWrapper({
  values = defaultValues,
}: {
  values?: Partial<BaseTableFormValues>;
}) {
  const form = useForm({ defaultValues: values });

  return (
    <FormProvider {...form}>
      {values.columns?.map(({ name }, index) => (
        <UniqueCheckbox key={name} index={index} />
      ))}
      <UniqueKeysSection />
    </FormProvider>
  );
}

async function renameUniqueKey(index: number, name: string) {
  const user = new TestUserEvent();

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[index]);

  const nameInput = screen.getByLabelText('Name');
  await user.clear(nameInput);
  await user.type(nameInput, name);
}

async function pickColumnsForNewUniqueKey(columnNames: string[]) {
  const user = new TestUserEvent();

  await user.click(
    screen.getByRole('button', { name: 'Add Unique Constraint' }),
  );
  await user.click(screen.getByRole('combobox', { name: 'Columns' }));

  for (const columnName of columnNames) {
    await user.click(screen.getByRole('option', { name: columnName }));
  }
}

describe('UniqueKeysSection', () => {
  it('rejects a name another unique constraint already uses', async () => {
    render(<TestWrapper />);

    await renameUniqueKey(1, 'orders_tenant_id_order_id_key');

    expect(
      screen.getByText('A unique constraint with this name already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('accepts the edited unique constraint keeping its own name', async () => {
    render(<TestWrapper />);

    await renameUniqueKey(1, 'orders_order_id_sku_key');

    expect(
      screen.queryByText('A unique constraint with this name already exists.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('rejects columns another unique constraint already uses, in any order', async () => {
    render(<TestWrapper />);

    await pickColumnsForNewUniqueKey(['order_id', 'tenant_id']);

    expect(
      screen.getByText('A unique constraint on these columns already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('filters the columns by name', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.click(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await user.click(screen.getByRole('combobox', { name: 'Columns' }));
    const searchInput = screen.getByPlaceholderText('Search columns...');

    await user.type(searchInput, 'sku');

    expect(screen.getByRole('option', { name: 'sku' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'order_id' }),
    ).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'zzz');

    expect(screen.getByText('No columns found.')).toBeInTheDocument();
  });

  it('ticks the Unique checkbox of a single column added from the dialog', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await pickColumnsForNewUniqueKey(['sku']);
    await user.click(screen.getByRole('combobox', { name: 'Columns' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByTestId('columns.2.isUnique')).toBeChecked();
  });

  it('adds and removes a single-column unique constraint with the Unique checkbox', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    const checkbox = screen.getByTestId('columns.2.isUnique');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByText('sku')).toBeInTheDocument();

    await user.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(screen.queryByText('sku')).not.toBeInTheDocument();
  });

  it('unticks the Unique checkbox when its constraint is deleted', async () => {
    const user = new TestUserEvent();
    render(
      <TestWrapper
        values={{
          ...defaultValues,
          uniqueKeys: [{ name: 'orders_sku_key', columnIndices: ['2'] }],
        }}
      />,
    );

    expect(screen.getByTestId('columns.2.isUnique')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByTestId('columns.2.isUnique')).not.toBeChecked();
  });

  it('shows a column a unique index keeps unique as ticked and locked', () => {
    render(
      <TestWrapper
        values={{ ...defaultValues, uniqueIndexColumnIds: ['sku'] }}
      />,
    );

    const checkbox = screen.getByTestId('columns.2.isUnique');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
  });
});
