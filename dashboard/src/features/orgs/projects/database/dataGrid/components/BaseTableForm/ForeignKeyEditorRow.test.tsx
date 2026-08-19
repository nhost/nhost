import { FormProvider, useForm } from 'react-hook-form';
import ForeignKeyEditorRow from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ForeignKeyEditorRow';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { render, screen } from '@/tests/testUtils';

function TestWrapper({ relation }: { relation: ForeignKeyRelation }) {
  const form = useForm({ defaultValues: { foreignKeyRelations: [relation] } });

  return (
    <FormProvider {...form}>
      <ForeignKeyEditorRow index={0} onEdit={vi.fn()} onDelete={vi.fn()} />
    </FormProvider>
  );
}

describe('ForeignKeyEditorRow', () => {
  it('displays complete composite mappings and disables unsupported actions', () => {
    render(
      <TestWrapper
        relation={{
          name: 'membership_user_fkey',
          columns: ['tenant_id', 'user_id'],
          referencedSchema: 'public',
          referencedTable: 'users',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'NO ACTION',
          deleteAction: 'NO ACTION',
        }}
      />,
    );

    expect(screen.getByText('tenant_id, user_id')).toBeInTheDocument();
    expect(screen.getByText(/public\.users\./)).toHaveTextContent(
      'public.users.tenant_id, id',
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
