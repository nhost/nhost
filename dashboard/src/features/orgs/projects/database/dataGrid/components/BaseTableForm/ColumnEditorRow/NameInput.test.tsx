import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { NameInput } from './NameInput';

interface FormValues {
  columns: { name: string }[];
  foreignKeyRelations: { columns: string[] }[];
  primaryKeyIndices: string[];
}

let form: UseFormReturn<FormValues>;

function TestWrapper() {
  form = useForm<FormValues>({
    defaultValues: {
      columns: [{ name: 'tenant_id' }],
      foreignKeyRelations: [
        { columns: ['tenant_id', 'order_id'] },
        { columns: ['tenant_id', 'customer_id'] },
      ],
      primaryKeyIndices: [],
    },
  });

  return (
    <FormProvider {...form}>
      <NameInput index={0} />
    </FormProvider>
  );
}

describe('NameInput', () => {
  it('renames the column in every foreign key that contains it', async () => {
    render(<TestWrapper />);

    await new TestUserEvent().type(screen.getByLabelText('Name'), 'x');

    expect(form.getValues('foreignKeyRelations')).toEqual([
      { columns: ['tenant_idx', 'order_id'] },
      { columns: ['tenant_idx', 'customer_id'] },
    ]);
  });
});
