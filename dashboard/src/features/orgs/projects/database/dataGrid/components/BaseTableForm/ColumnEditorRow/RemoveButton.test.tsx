import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { RemoveButton } from './RemoveButton';

// Mock the form data structure
interface FormData {
  name?: string;
  columns: Array<{ name: string; type: string; formReference: string }>;
  foreignKeyRelations: Array<{
    columns: string[];
    referencedSchema: string;
    referencedTable: string;
    referencedColumns: string[];
  }>;
  uniqueConstraints: Array<{
    id: string;
    columnReferences: string[];
  }>;
  primaryKeyIndices: string[];
  identityColumnIndex: number | null;
}

// Test wrapper component that provides form context and exposes form values
function TestWrapper({
  children,
  defaultValues,
  onFormChange,
}: {
  children: React.ReactNode;
  defaultValues: FormData;
  onFormChange?: (values: FormData) => void;
}) {
  const methods = useForm<FormData>({
    defaultValues,
  });

  const formValues = methods.watch();

  // Expose form values to test
  useEffect(() => {
    if (onFormChange) {
      onFormChange(formValues);
    }
  }, [formValues, onFormChange]);

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('RemoveButton onClick', () => {
  const user = new TestUserEvent();

  const defaultFormData: FormData = {
    columns: [
      { name: 'id', type: 'integer', formReference: 'id-reference' },
      { name: 'name', type: 'text', formReference: 'name-reference' },
      { name: 'email', type: 'text', formReference: 'email-reference' },
    ],
    foreignKeyRelations: [
      {
        columns: ['name'],
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumns: ['username'],
      },
    ],
    uniqueConstraints: [],
    primaryKeyIndices: ['0', '1'],
    identityColumnIndex: 1,
  };

  it('should not remove primary key index when column is not a primary key', async () => {
    let formValues: FormData;

    render(
      <TestWrapper
        defaultValues={defaultFormData}
        onFormChange={(values) => {
          formValues = values;
        }}
      >
        <RemoveButton index={2} />
      </TestWrapper>,
    );

    const button = screen.getByTestId('remove-column-2');
    await user.click(button);

    expect(formValues!.primaryKeyIndices).toEqual(['0', '1']);
    expect(formValues!.foreignKeyRelations).toEqual([
      {
        columns: ['name'],
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumns: ['username'],
      },
    ]);
    expect(formValues!.identityColumnIndex).toBe(1);
  });

  it('removes self foreign keys and UNIQUE constraints that reference the removed column', async () => {
    let formValues: FormData;

    render(
      <TestWrapper
        defaultValues={{
          ...defaultFormData,
          name: 'users',
          foreignKeyRelations: [
            {
              columns: ['email'],
              referencedSchema: 'public',
              referencedTable: 'users',
              referencedColumns: ['id', 'name'],
            },
          ],
          uniqueConstraints: [
            {
              id: 'composite-key',
              columnReferences: ['id-reference', 'name-reference'],
            },
            {
              id: 'email-key',
              columnReferences: ['email-reference'],
            },
          ],
        }}
        onFormChange={(values) => {
          formValues = values;
        }}
      >
        <RemoveButton index={1} schema="public" />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('remove-column-1'));

    expect(formValues!.foreignKeyRelations).toEqual([]);
    expect(formValues!.uniqueConstraints).toEqual([
      {
        id: 'email-key',
        columnReferences: ['email-reference'],
      },
    ]);
  });

  it('should handle multiple operations simultaneously', async () => {
    let formValues: FormData;

    render(
      <TestWrapper
        defaultValues={defaultFormData}
        onFormChange={(values) => {
          formValues = values;
        }}
      >
        <RemoveButton index={1} />
      </TestWrapper>,
    );

    const button = screen.getByTestId('remove-column-1');
    await user.click(button);

    expect(formValues!.primaryKeyIndices).toEqual(['0']);
    expect(formValues!.foreignKeyRelations).toEqual([]);
    expect(formValues!.identityColumnIndex).toBeNull();
  });
});
