import { FormProvider, useForm } from 'react-hook-form';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import UniqueKeysSection from './UniqueKeysSection';

mockScrollIntoViewAndPointerCapture();

function TestWrapper() {
  const form = useForm({
    defaultValues: {
      columns: [{ name: 'tenant_id' }, { name: 'order_id' }, { name: 'sku' }],
      uniqueKeys: [
        { name: 'orders_tenant_id_order_id_key', columnIndices: ['0', '1'] },
        { name: 'orders_order_id_sku_key', columnIndices: ['1', '2'] },
      ],
    },
  });

  return (
    <FormProvider {...form}>
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
});
