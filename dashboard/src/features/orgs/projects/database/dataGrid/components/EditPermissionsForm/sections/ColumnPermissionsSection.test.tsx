import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import ColumnPermissionsSection, {
  type ColumnPermissionsSectionProps,
} from './ColumnPermissionsSection';

const { mockColumnsRef } = vi.hoisted(() => ({
  mockColumnsRef: {
    current: [{ column_name: 'id' }, { column_name: 'name' }] as Array<
      Record<string, unknown>
    >,
  },
}));

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: () => ({
      data: { columns: mockColumnsRef.current },
      status: 'success',
      error: null,
    }),
  }),
);

function withColumns(columns: Array<Record<string, unknown>>) {
  mockColumnsRef.current = columns;
}

beforeEach(() => {
  withColumns([{ column_name: 'id' }, { column_name: 'name' }]);
});

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

  describe('generated columns', () => {
    it('disables a generated column for the insert action', () => {
      withColumns([
        { column_name: 'id' },
        { column_name: 'full_name', is_generated: 'ALWAYS' },
      ]);

      render(
        <TestWrapper>
          <ColumnPermissionsSection {...baseProps} action="insert" />
        </TestWrapper>,
      );

      expect(screen.getByRole('checkbox', { name: 'id' })).toBeEnabled();
      expect(
        screen.getByRole('checkbox', { name: 'full_name' }),
      ).toBeDisabled();
    });

    it('disables a generated column for the update action', () => {
      withColumns([
        { column_name: 'id' },
        { column_name: 'full_name', is_generated: 'ALWAYS' },
      ]);

      render(
        <TestWrapper>
          <ColumnPermissionsSection {...baseProps} action="update" />
        </TestWrapper>,
      );

      expect(
        screen.getByRole('checkbox', { name: 'full_name' }),
      ).toBeDisabled();
    });

    it('keeps a generated column enabled for the select action', () => {
      withColumns([
        { column_name: 'id' },
        { column_name: 'full_name', is_generated: 'ALWAYS' },
      ]);

      render(
        <TestWrapper>
          <ColumnPermissionsSection {...baseProps} action="select" />
        </TestWrapper>,
      );

      expect(screen.getByRole('checkbox', { name: 'full_name' })).toBeEnabled();
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

    it('"Select All" on insert skips generated columns', async () => {
      withColumns([
        { column_name: 'id' },
        { column_name: 'name' },
        { column_name: 'full_name', is_generated: 'ALWAYS' },
      ]);

      render(
        <TestWrapper>
          <ColumnPermissionsSection {...baseProps} action="insert" />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: 'Select All' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'name' })).toBeChecked();
        expect(
          screen.getByRole('checkbox', { name: 'full_name' }),
        ).not.toBeChecked();
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
