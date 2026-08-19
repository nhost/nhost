import { FormProvider, useForm } from 'react-hook-form';
import { NameInput } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ColumnEditorRow/NameInput';
import { render, screen } from '@/tests/testUtils';

function TestWrapper() {
  const form = useForm({
    defaultValues: {
      columns: [
        { name: 'tenant_id', type: 'uuid' },
        { name: 'user_id', type: 'uuid' },
      ],
      primaryKeyIndices: [],
      foreignKeyRelations: [
        {
          name: 'membership_user_fkey',
          columns: ['tenant_id', 'user_id'],
          referencedSchema: 'public',
          referencedTable: 'users',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'NO ACTION',
          deleteAction: 'NO ACTION',
        },
      ],
    },
  });

  return (
    <FormProvider {...form}>
      <NameInput index={0} />
    </FormProvider>
  );
}

describe('NameInput', () => {
  it('blocks renaming a participant in a loaded composite relation', () => {
    render(<TestWrapper />);

    expect(screen.getByTestId('columns.0.name')).toBeDisabled();
  });
});
