import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { NameInput } from './NameInput';

interface FormData {
  columns: Array<{ name: string; type: string }>;
  foreignKeyRelations: Array<{
    columns: string[];
    referencedSchema: string;
    referencedTable: string;
    referencedColumns: string[];
  }>;
  primaryKeyIndices: string[];
}

let formMethods: UseFormReturn<FormData>;

// The wrapper must not watch() form values: re-rendering NameInput on every
// keystroke would mask stale-closure regressions in its onChange handler.
function TestWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues: FormData;
}) {
  const methods = useForm<FormData>({ defaultValues });
  formMethods = methods;
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('NameInput foreign key sync', () => {
  const user = new TestUserEvent();

  it('should keep composite foreign key columns in sync across a multi-keystroke rename', async () => {
    render(
      <TestWrapper
        defaultValues={{
          columns: [
            { name: 'tenant_id', type: 'uuid' },
            { name: 'parent_code', type: 'text' },
          ],
          foreignKeyRelations: [
            {
              columns: ['tenant_id', 'parent_code'],
              referencedSchema: 'public',
              referencedTable: 'departments',
              referencedColumns: ['tenant_id', 'code'],
            },
          ],
          primaryKeyIndices: [],
        }}
      >
        <NameInput index={1} />
      </TestWrapper>,
    );

    const input = screen.getByTestId('columns.1.name');
    await user.type(input, '{Backspace}{Backspace}{Backspace}{Backspace}key');

    expect(formMethods.getValues('columns.1.name')).toBe('parent_key');
    expect(formMethods.getValues('foreignKeyRelations.0.columns')).toEqual([
      'tenant_id',
      'parent_key',
    ]);
  });

  it('should update every foreign key relation containing the renamed column', async () => {
    render(
      <TestWrapper
        defaultValues={{
          columns: [
            { name: 'tenant_id', type: 'uuid' },
            { name: 'parent_code', type: 'text' },
          ],
          foreignKeyRelations: [
            {
              columns: ['tenant_id', 'parent_code'],
              referencedSchema: 'public',
              referencedTable: 'departments',
              referencedColumns: ['tenant_id', 'code'],
            },
            {
              columns: ['tenant_id'],
              referencedSchema: 'public',
              referencedTable: 'tenants',
              referencedColumns: ['id'],
            },
          ],
          primaryKeyIndices: [],
        }}
      >
        <NameInput index={0} />
      </TestWrapper>,
    );

    const input = screen.getByTestId('columns.0.name');
    await user.clear(input);
    await user.type(input, 'org_id');

    expect(formMethods.getValues('columns.0.name')).toBe('org_id');
    expect(formMethods.getValues('foreignKeyRelations.0.columns')).toEqual([
      'org_id',
      'parent_code',
    ]);
    expect(formMethods.getValues('foreignKeyRelations.1.columns')).toEqual([
      'org_id',
    ]);
  });

  it('should leave foreign keys untouched when renaming an unrelated column', async () => {
    render(
      <TestWrapper
        defaultValues={{
          columns: [
            { name: 'tenant_id', type: 'uuid' },
            { name: 'title', type: 'text' },
          ],
          foreignKeyRelations: [
            {
              columns: ['tenant_id'],
              referencedSchema: 'public',
              referencedTable: 'tenants',
              referencedColumns: ['id'],
            },
          ],
          primaryKeyIndices: [],
        }}
      >
        <NameInput index={1} />
      </TestWrapper>,
    );

    const input = screen.getByTestId('columns.1.name');
    await user.type(input, '{Backspace}{Backspace}me');

    expect(formMethods.getValues('columns.1.name')).toBe('titme');
    expect(formMethods.getValues('foreignKeyRelations.0.columns')).toEqual([
      'tenant_id',
    ]);
  });
});
