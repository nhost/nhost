import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import ColumnPermissionsSection, {
  type ColumnPermissionsSectionProps,
} from './ColumnPermissionsSection';

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: () => ({
      data: { columns: [{ column_name: 'id' }, { column_name: 'name' }] },
      status: 'success',
      error: null,
    }),
  }),
);

function TestWrapper({
  children,
  defaultValues,
}: {
  children: ReactNode;
  defaultValues?: Partial<RolePermissionEditorFormValues>;
}) {
  const form = useForm<RolePermissionEditorFormValues>({
    defaultValues: {
      rowCheckType: 'none',
      filter: {},
      columns: [],
      computedFields: [],
      ...defaultValues,
    },
  });
  return <FormProvider {...form}>{children}</FormProvider>;
}

const baseProps: ColumnPermissionsSectionProps = {
  role: 'user',
  action: 'select',
  schema: 'public',
  table: 'users',
};

describe('ColumnPermissionsSection', () => {
  describe('select action with computed fields configured', () => {
    it('renders both column and computed-field checkboxes', () => {
      render(
        <TestWrapper>
          <ColumnPermissionsSection
            {...baseProps}
            availableComputedFields={['full_name', 'age_in_days']}
          />
        </TestWrapper>,
      );

      expect(screen.getByRole('checkbox', { name: 'id' })).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'name' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'full_name' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'age_in_days' }),
      ).toBeInTheDocument();
    });

    it('reflects previously-saved column and computed-field selections as checked', () => {
      render(
        <TestWrapper
          defaultValues={{
            columns: ['id'],
            computedFields: ['full_name'],
          }}
        >
          <ColumnPermissionsSection
            {...baseProps}
            availableComputedFields={['full_name', 'age_in_days']}
          />
        </TestWrapper>,
      );

      expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'full_name' })).toBeChecked();
      expect(
        screen.getByRole('checkbox', { name: 'age_in_days' }),
      ).not.toBeChecked();
    });
  });

  describe('no computed fields configured', () => {
    it('renders only column checkboxes', () => {
      render(
        <TestWrapper>
          <ColumnPermissionsSection {...baseProps} />
        </TestWrapper>,
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      expect(screen.getByRole('checkbox', { name: 'id' })).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'name' }),
      ).toBeInTheDocument();
    });
  });

  describe('Toggle All button', () => {
    it('"Select All" checks every column AND every computed-field checkbox', async () => {
      render(
        <TestWrapper>
          <ColumnPermissionsSection
            {...baseProps}
            availableComputedFields={['full_name']}
          />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: 'Select All' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'name' })).toBeChecked();
        expect(
          screen.getByRole('checkbox', { name: 'full_name' }),
        ).toBeChecked();
      });
    });

    it('"Deselect All" clears every column AND every computed-field checkbox', async () => {
      render(
        <TestWrapper
          defaultValues={{
            columns: ['id', 'name'],
            computedFields: ['full_name'],
          }}
        >
          <ColumnPermissionsSection
            {...baseProps}
            availableComputedFields={['full_name']}
          />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: 'Deselect All' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: 'id' })).not.toBeChecked();
        expect(
          screen.getByRole('checkbox', { name: 'name' }),
        ).not.toBeChecked();
        expect(
          screen.getByRole('checkbox', { name: 'full_name' }),
        ).not.toBeChecked();
      });
    });
  });
});
