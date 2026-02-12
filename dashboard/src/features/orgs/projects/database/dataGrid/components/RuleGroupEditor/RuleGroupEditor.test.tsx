import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
  LogicalOperator,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2/types';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import RuleGroupEditor from './RuleGroupEditor';

vi.mock(
  '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete',
  () => ({
    ColumnAutocomplete: ({ value, ...props }: Record<string, unknown>) => (
      <button type="button" data-testid="column-autocomplete" {...props}>
        {(value as string) || 'Select column'}
      </button>
    ),
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/components/RuleGroupEditor/OperatorComboBox',
  () => ({
    default: ({ name }: { name: string }) => (
      <div data-testid="operator-combobox">{name}</div>
    ),
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/components/RuleGroupEditor/RuleValueInput',
  () => ({
    default: ({ name }: { name: string }) => (
      <div data-testid="rule-value-input">{name}</div>
    ),
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/components/RuleGroupEditor/TableComboBox',
  () => ({
    default: ({
      schema,
      table,
    }: {
      schema: string;
      table: string;
      onChange: (v: { schema: string; table: string }) => void;
    }) => (
      <div data-testid="table-combobox">
        {schema && table ? `${schema}.${table}` : 'Select table...'}
      </div>
    ),
  }),
);

function condition(
  column: string,
  operator: HasuraOperator = '_eq',
  value: unknown = '',
): ConditionNode {
  return {
    type: 'condition',
    id: crypto.randomUUID(),
    column,
    operator,
    value,
  };
}

function group(operator: LogicalOperator, children: RuleNode[]): GroupNode {
  return {
    type: 'group',
    id: crypto.randomUUID(),
    operator,
    children,
  };
}

function existsNode(
  schema: string,
  table: string,
  where?: GroupNode,
): ExistsNode {
  return {
    type: 'exists',
    id: crypto.randomUUID(),
    schema,
    table,
    where: where ?? group('_and', [condition('id')]),
  };
}

function TestWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues: Record<string, unknown>;
}) {
  const form = useForm({ defaultValues });
  return <FormProvider {...form}>{children}</FormProvider>;
}

const defaultProps = {
  schema: 'public',
  table: 'users',
  name: 'rule',
};

describe('RuleGroupEditor', () => {
  beforeEach(() => {
    mockPointerEvent();
  });

  describe('rendering', () => {
    it('renders a single condition row from default values', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(1);
    });

    it('renders multiple conditions in order', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('name'),
              condition('email'),
              condition('age'),
            ]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const comboboxes = screen.getAllByTestId('operator-combobox');
      expect(comboboxes).toHaveLength(3);
      expect(comboboxes[0]).toHaveTextContent('rule.children.0');
      expect(comboboxes[1]).toHaveTextContent('rule.children.1');
      expect(comboboxes[2]).toHaveTextContent('rule.children.2');
    });

    it('renders nested groups recursively', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('name'),
              group('_or', [condition('email')]),
            ]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(2);
    });

    it('renders the correct operator label (AND/OR/NOT)', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_not', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('NOT')).toBeInTheDocument();
    });
  });

  describe('adding nodes', () => {
    it('clicking "+ Rule" appends a condition row', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(1);

      const user = new TestUserEvent();
      const addRuleButton = screen.getByRole('button', { name: /rule/i });
      await user.click(addRuleButton);

      await waitFor(() => {
        expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(2);
      });
    });

    it('clicking "+ Group" appends a nested group with one condition', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      const addGroupButton = screen.getByRole('button', { name: /group/i });
      await user.click(addGroupButton);

      await waitFor(() => {
        expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(2);
      });

      const operatorBadges = screen.getAllByText('AND');
      expect(operatorBadges).toHaveLength(2);
    });
  });

  describe('removing nodes', () => {
    it('clicking remove button on a condition removes it', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name'), condition('email')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(2);

      const user = new TestUserEvent();
      const removeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-x'));
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(1);
      });
    });

    it('remove button is disabled when only one child remains', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const removeButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('.lucide-x'));
      expect(removeButton).toBeDisabled();
    });

    it('"Delete Group" button appears for nested groups and removes the group', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('name'),
              group('_or', [condition('email')]),
            ]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const deleteGroupButton = screen.getByRole('button', {
        name: /delete group/i,
      });
      expect(deleteGroupButton).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(deleteGroupButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /delete group/i }),
        ).not.toBeInTheDocument();
      });

      expect(screen.getAllByTestId('column-autocomplete')).toHaveLength(1);
    });

    it('"Delete Group" button does NOT appear on the root group', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(
        screen.queryByRole('button', { name: /delete group/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('operator switching', () => {
    it('clicking the operator badge opens dropdown with AND/OR/NOT options', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      const badge = screen.getByText('AND');
      await user.click(badge);

      await waitFor(() => {
        expect(
          screen.getByRole('menuitemradio', { name: 'AND' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('menuitemradio', { name: 'OR' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('menuitemradio', { name: 'NOT' }),
        ).toBeInTheDocument();
      });
    });

    it('selecting a different operator updates the displayed label', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('AND'));

      await waitFor(() => {
        expect(
          screen.getByRole('menuitemradio', { name: 'OR' }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitemradio', { name: 'OR' }));

      await waitFor(() => {
        expect(screen.getByText('OR')).toBeInTheDocument();
      });
    });
  });

  describe('depth limiting', () => {
    it('"+ Group" button is disabled when maxDepth is reached', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} maxDepth={1} />
        </TestWrapper>,
      );

      const addGroupButton = screen.getByRole('button', { name: /group/i });
      expect(addGroupButton).toBeDisabled();
    });

    it('"+ Group" button is enabled when under maxDepth', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} maxDepth={3} />
        </TestWrapper>,
      );

      const addGroupButton = screen.getByRole('button', { name: /group/i });
      expect(addGroupButton).not.toBeDisabled();
    });

    it('"+ Group" button is disabled in nested group at maxDepth', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [group('_or', [condition('name')])]),
          }}
        >
          <RuleGroupEditor {...defaultProps} maxDepth={2} />
        </TestWrapper>,
      );

      // Filter to only "+ Group" buttons, excluding "Delete Group".
      // Child groups render before the parent's action buttons in DOM order,
      // so [0] is the nested group's button (disabled) and [1] is the root's (enabled).
      const addGroupButtons = screen
        .getAllByRole('button', { name: /group/i })
        .filter((btn) => btn.querySelector('.lucide-plus'));
      expect(addGroupButtons).toHaveLength(2);
      expect(addGroupButtons[0]).toBeDisabled();
      expect(addGroupButtons[1]).not.toBeDisabled();
    });
  });

  describe('disabled state', () => {
    it('condition row remove buttons are disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name'), condition('email')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      const removeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-x'));

      for (const btn of removeButtons) {
        expect(btn).toBeDisabled();
      }
    });
  });

  describe('exists nodes', () => {
    it('renders "Exists" button in the controls row', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(
        screen.getByRole('button', { name: /exists/i }),
      ).toBeInTheDocument();
    });

    it('clicking "+ Exists" appends an exists node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('name')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      const existsButton = screen.getByRole('button', { name: /exists/i });
      await user.click(existsButton);

      await waitFor(() => {
        expect(screen.getByTestId('table-combobox')).toBeInTheDocument();
      });
    });

    it('renders an existing exists node from default values', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('name'),
              existsNode('public', 'users'),
            ]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('table-combobox')).toBeInTheDocument();
      expect(screen.getByText('public.users')).toBeInTheDocument();
    });

    it('"+ Exists" button does not appear inside an ExistsNodeRenderer (allowExistsNodes=false)', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [existsNode('public', 'users')]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      // Only the outer root group should have a "+ Exists" button (with Plus icon).
      // The inner GroupNodeRenderer inside ExistsNodeRenderer has allowExistsNodes=false,
      // so it should NOT render a "+ Exists" button.
      const addExistsButtons = screen
        .getAllByRole('button')
        .filter(
          (btn) =>
            btn.textContent?.includes('Exists') &&
            btn.querySelector('.lucide-plus'),
        );

      expect(addExistsButtons).toHaveLength(1);
    });

    it('"Delete Exists" button removes the exists node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('name'),
              existsNode('public', 'users'),
            ]),
          }}
        >
          <RuleGroupEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('table-combobox')).toBeInTheDocument();

      const user = new TestUserEvent();
      const deleteButton = screen.getByRole('button', {
        name: /delete exists/i,
      });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByTestId('table-combobox')).not.toBeInTheDocument();
      });
    });
  });
});
