import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { RemoveButton } from './RemoveButton';

// Mock the form data structure
interface FormData {
  columns: Array<{ name: string; type: string }>;
  foreignKeyRelations: Array<{
    columnName: string;
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
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
      { name: 'id', type: 'integer' },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
    ],
    foreignKeyRelations: [
      {
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumn: 'username',
      },
    ],
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
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumn: 'username',
      },
    ]);
    expect(formValues!.identityColumnIndex).toBe(1);
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
