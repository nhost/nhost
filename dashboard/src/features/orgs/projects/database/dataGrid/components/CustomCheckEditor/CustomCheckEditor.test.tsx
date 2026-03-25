import { setupServer } from 'msw/node';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
  LogicalOperator,
  RelationshipNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import CustomCheckEditor from './CustomCheckEditor';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const server = setupServer(
  tokenQuery,
  tableQuery,
  hasuraMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
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
    where: where ?? group('_implicit', [condition('id')]),
  };
}

function relationshipNode(
  relationship: string,
  child?: GroupNode,
): RelationshipNode {
  return {
    type: 'relationship',
    id: crypto.randomUUID(),
    relationship,
    child: child ?? group('_implicit', [condition('id')]),
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
  table: 'books',
  name: 'rule',
};

describe('CustomCheckEditor', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    // Required so useLocalMimirClient sends GetRolesPermissions to a URL MSW can intercept
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen();
  });

  beforeEach(() => {
    mockPointerEvent();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/xyz/projects/test-project',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: '/orgs/xyz/projects/test-project',
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
      query: {
        orgSlug: 'xyz',
        appSubdomain: 'test-project',
        dataSourceSlug: 'default',
      },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
      forward: vi.fn(),
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('rendering', () => {
    it('renders a single condition row from default values', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(await screen.findByText('title')).toBeInTheDocument();
    });

    it('renders multiple conditions in order', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              condition('release_date'),
              condition('author_id'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('author_id')).toBeInTheDocument();
    });

    it('renders nested groups recursively', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
    });

    it('renders the correct operator label (AND/OR/NOT)', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_not', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('NOT')).toBeInTheDocument();
    });

    it('renders "Implicit" label for _implicit operator', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('Implicit')).toBeInTheDocument();
    });

    it('renders an empty group (no children) without crashing', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', []),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
    });

    it('applies depth-based background colors to nested groups', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              group('_or', [group('_and', [condition('title')])]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const groupDivs = document.querySelectorAll(
        'div.rounded-lg[class*="bg-secondary-"]',
      );

      expect(groupDivs).toHaveLength(3);
      expect(groupDivs[0]).toHaveClass('bg-secondary-100');
      expect(groupDivs[1]).toHaveClass('bg-secondary-200');
      expect(groupDivs[2]).toHaveClass('bg-secondary-300');
    });
  });

  describe('adding nodes', () => {
    async function openAddPopover(user: TestUserEvent, index = -1) {
      const buttons = screen.getAllByRole('button', { name: /Add/ });
      const btn = index >= 0 ? buttons[index] : buttons[buttons.length - 1];
      await user.click(btn);
    }

    it('selecting a column appends a condition row', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      await openAddPopover(user);
      await user.click(
        await screen.findByRole('option', { name: /release_date/ }),
      );

      await waitFor(() => {
        expect(screen.getByText('release_date')).toBeInTheDocument();
      });
    });

    it('selecting "and" appends a nested group', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await openAddPopover(user);
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        expect(screen.getAllByText('AND')).toHaveLength(2);
      });
    });

    it('selecting "or" appends a nested OR group', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await openAddPopover(user);
      await user.click(await screen.findByRole('option', { name: 'or' }));

      await waitFor(() => {
        expect(screen.getByText('OR')).toBeInTheDocument();
      });
    });

    it('selecting "exists" appends an exists node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await openAddPopover(user);
      await user.click(await screen.findByRole('option', { name: 'exists' }));

      await waitFor(() => {
        expect(screen.getByText('Exists')).toBeInTheDocument();
        expect(screen.getByText('Select table...')).toBeInTheDocument();
      });
    });

    it('adding multiple rules in sequence renders all of them', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();

      await openAddPopover(user);
      await user.click(
        await screen.findByRole('option', { name: /release_date/ }),
      );
      await waitFor(() => {
        expect(screen.getByText('release_date')).toBeInTheDocument();
      });

      await openAddPopover(user);
      await user.click(
        await screen.findByRole('option', { name: /author_id/ }),
      );
      await waitFor(() => {
        expect(screen.getByText('author_id')).toBeInTheDocument();
      });

      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('author_id')).toBeInTheDocument();
    });

    it('adding a rule inside a nested group adds it to the correct group', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      await screen.findByText('title');

      const user = new TestUserEvent();
      // The nested group's Add button renders before the root's in DOM order
      await openAddPopover(user, 0);
      await user.click(
        await screen.findByRole('option', { name: /author_id/ }),
      );

      await waitFor(() => {
        expect(screen.getByText('author_id')).toBeInTheDocument();
      });

      // All three conditions should be visible
      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('author_id')).toBeInTheDocument();
    });
  });

  describe('removing nodes', () => {
    it('clicking remove button on a condition removes it', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              condition('release_date'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();

      const user = new TestUserEvent();
      const removeButtons = screen.getAllByRole('button', {
        name: /delete condition/i,
      });
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('title')).not.toBeInTheDocument();
      });

      expect(screen.getByText('release_date')).toBeInTheDocument();
    });

    it('remove button is enabled even when one child remains', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const removeButton = screen.getByRole('button', {
        name: /delete condition/i,
      });
      expect(removeButton).toBeEnabled();
    });

    it('"Delete Group" button appears for nested groups and removes the group', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();

      const deleteGroupButtons = screen.getAllByRole('button', {
        name: /delete group/i,
      });
      expect(deleteGroupButtons.length).toBeGreaterThanOrEqual(2);

      const user = new TestUserEvent();
      await user.click(deleteGroupButtons[deleteGroupButtons.length - 1]);

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /delete group/i }),
        ).toHaveLength(1);
      });

      expect(screen.queryByText('OR')).not.toBeInTheDocument();
      expect(screen.queryByText('release_date')).not.toBeInTheDocument();
      expect(screen.getByText('title')).toBeInTheDocument();
    });

    it('"Delete Group" button appears on the root group (allows resetting to empty state)', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(
        screen.getByRole('button', { name: /delete group/i }),
      ).toBeInTheDocument();
    });

    it('remove button is enabled for the last child when operator is _implicit', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const removeButton = screen.getByRole('button', {
        name: /delete condition/i,
      });
      expect(removeButton).not.toBeDisabled();
    });

    it('removing a nested group also removes all its children from the DOM', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date'), condition('author_id')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('author_id')).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();

      const user = new TestUserEvent();
      const deleteGroupButtons = screen.getAllByRole('button', {
        name: /delete group/i,
      });
      await user.click(deleteGroupButtons[deleteGroupButtons.length - 1]);

      await waitFor(() => {
        expect(screen.queryByText('OR')).not.toBeInTheDocument();
      });

      expect(screen.queryByText('release_date')).not.toBeInTheDocument();
      expect(screen.queryByText('author_id')).not.toBeInTheDocument();
      expect(screen.getByText('title')).toBeInTheDocument();
    });
  });

  describe('operator switching', () => {
    it('clicking the operator badge opens dropdown with all operator options', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('AND'));

      await waitFor(() => {
        expect(
          screen.getByRole('menuitemradio', { name: /Implicit/ }),
        ).toBeInTheDocument();
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
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
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

    it('selecting "Implicit" updates the displayed label', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('AND'));

      await waitFor(() => {
        expect(
          screen.getByRole('menuitemradio', { name: /Implicit/ }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitemradio', { name: /Implicit/ }));

      await waitFor(() => {
        expect(screen.getByText('Implicit')).toBeInTheDocument();
      });
    });

    it('operator badge dropdown is disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      const badge = screen.getByText('AND');
      // When disabled, Radix sets data-disabled on the trigger element
      const trigger = badge.closest('[data-disabled]');
      expect(trigger).toBeInTheDocument();
    });

    it('nested group operator changes independently from parent group operator', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('OR'));

      await waitFor(() => {
        expect(
          screen.getByRole('menuitemradio', { name: 'NOT' }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitemradio', { name: 'NOT' }));

      await waitFor(() => {
        expect(screen.getByText('NOT')).toBeInTheDocument();
      });

      expect(screen.getByText('AND')).toBeInTheDocument();
    });
  });

  describe('depth limiting', () => {
    it('adding a group still works when maxDepth is set (AddNodeButton does not enforce maxDepth)', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} maxDepth={1} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        expect(screen.getAllByText('AND')).toHaveLength(2);
      });
    });

    it('no maxDepth prop allows unlimited nesting', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              group('_or', [
                group('_and', [
                  group('_or', [group('_and', [condition('title')])]),
                ]),
              ]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const addButtons = screen.getAllByRole('button', { name: /Add/ });
      expect(addButtons).toHaveLength(5);
    });

    it('maxDepth limits rendering depth of existing nested groups', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              group('_or', [group('_and', [condition('title')])]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} maxDepth={2} />
        </TestWrapper>,
      );

      // All existing groups still render since maxDepth controls the Add dropdown
      expect(screen.getAllByText('AND')).toHaveLength(2);
      expect(screen.getByText('OR')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('condition row remove buttons are disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              condition('release_date'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      const removeButtons = screen.getAllByRole('button', {
        name: /delete condition/i,
      });

      for (const btn of removeButtons) {
        expect(btn).toBeDisabled();
      }
    });

    it('"Add" button is disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      expect(screen.getByText('Add')).toBeDisabled();
    });

    it('"Delete Group" and "Delete Exists" buttons are disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
              existsNode('public', 'authors'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      const deleteGroupButtons = screen.getAllByRole('button', {
        name: /delete group/i,
      });
      for (const btn of deleteGroupButtons) {
        expect(btn).toBeDisabled();
      }

      const deleteExistsButton = screen.getByRole('button', {
        name: /delete exists/i,
      });
      expect(deleteExistsButton).toBeDisabled();
    });

    it('inner exists controls are disabled when disabled prop is true and table is selected', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [existsNode('public', 'authors')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      const addButtons = screen.getAllByText('Add');
      for (const btn of addButtons) {
        expect(btn).toBeDisabled();
      }

      const innerOperator = screen.getByText('Implicit');
      const trigger = innerOperator.closest('[data-disabled]');
      expect(trigger).toBeInTheDocument();
    });

    it('ConditionValue is disabled when disabled prop is true', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              condition('release_date'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      await waitFor(() => {
        // ConditionValue renders combobox buttons that should be disabled
        const comboboxes = screen.getAllByRole('combobox');
        // Filter to the value comboboxes (not column autocompletes)
        const disabledComboboxes = comboboxes.filter((cb) =>
          cb.hasAttribute('disabled'),
        );
        expect(disabledComboboxes.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('exists nodes', () => {
    it('"exists" option is available in AddNodeButton', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));

      expect(
        await screen.findByRole('option', { name: 'exists' }),
      ).toBeInTheDocument();
    });

    it('clicking "exists" menu item appends an exists node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));
      await user.click(await screen.findByRole('option', { name: 'exists' }));

      await waitFor(() => {
        expect(screen.getByText('Exists')).toBeInTheDocument();
        expect(screen.getByText('Select table...')).toBeInTheDocument();
      });
    });

    it('renders an existing exists node from default values', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              existsNode('public', 'authors'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('Exists')).toBeInTheDocument();
      expect(screen.getByText('public.authors')).toBeInTheDocument();
    });

    it('"exists" option appears inside an ExistsNodeRenderer Add button', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [existsNode('public', 'authors')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      // Two Add buttons: one inside the exists where clause, one at the root
      const addButtons = screen.getAllByText('Add');
      expect(addButtons).toHaveLength(2);

      const user = new TestUserEvent();
      await user.click(addButtons[0]);

      expect(
        await screen.findByRole('option', { name: 'exists' }),
      ).toBeInTheDocument();
    });

    it('renders a nested exists node inside an exists node', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              existsNode(
                'public',
                'town',
                group('_and', [
                  condition('name'),
                  existsNode('public', 'actor'),
                ]),
              ),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('public.town')).toBeInTheDocument();
      expect(screen.getByText('public.actor')).toBeInTheDocument();
    });

    it('exists node renders a TableComboBox and a nested group for the WHERE clause', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [existsNode('public', 'town')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('public.town')).toBeInTheDocument();
      expect(screen.getByText('Implicit')).toBeInTheDocument();
      expect(screen.getAllByText('Add')).toHaveLength(2);
    });

    it('nested conditions inside an exists node render alongside the exists table', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              existsNode(
                'public',
                'town',
                group('_implicit', [condition('name')]),
              ),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      // Root condition and exists node's inner condition both render
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      // The exists node shows its table
      expect(screen.getByText('public.town')).toBeInTheDocument();
    });

    it('"Delete Exists" button removes the exists node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              existsNode('public', 'authors'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('public.authors')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /delete exists/i }));

      await waitFor(() => {
        expect(screen.queryByText('public.authors')).not.toBeInTheDocument();
        expect(screen.queryByText('Exists')).not.toBeInTheDocument();
      });

      expect(await screen.findByText('title')).toBeInTheDocument();
    });
  });

  describe('condition row behavior', () => {
    it('changing the column resets operator to _eq', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              {
                type: 'condition',
                id: crypto.randomUUID(),
                column: 'title',
                operator: '_gt',
                value: 18,
              } satisfies ConditionNode,
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('_gt')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByText('title'));
      await user.click(
        await screen.findByRole('option', { name: /release_date/ }),
      );

      await waitFor(() => {
        expect(screen.getByText('release_date')).toBeInTheDocument();
        expect(screen.getByText('_eq')).toBeInTheDocument();
      });

      expect(screen.queryByText('_gt')).not.toBeInTheDocument();
    });
  });

  describe('relationship nodes', () => {
    it('selecting a relationship from AddNodeButton appends a relationship node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));
      // Use exact match to avoid matching the 'author_id' column option
      await user.click(await screen.findByRole('option', { name: 'author' }));

      await waitFor(() => {
        expect(screen.getByText('Relationship')).toBeInTheDocument();
        expect(screen.getByText('author')).toBeInTheDocument();
      });
    });

    it('renders an existing relationship node with badge and combobox', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              relationshipNode('author'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('Relationship')).toBeInTheDocument();
      expect(screen.getByText('author')).toBeInTheDocument();
    });

    it('"Delete relationship" button removes the relationship node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              relationshipNode('author'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('author')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(
        screen.getByRole('button', { name: /delete relationship/i }),
      );

      await waitFor(() => {
        expect(screen.queryByText('Relationship')).not.toBeInTheDocument();
        expect(screen.queryByText('author')).not.toBeInTheDocument();
      });

      expect(await screen.findByText('title')).toBeInTheDocument();
    });

    it('renders inner conditions inside a relationship node', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              relationshipNode(
                'author',
                group('_and', [condition('name'), condition('birth_date')]),
              ),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('name')).toBeInTheDocument();
      expect(await screen.findByText('birth_date')).toBeInTheDocument();
      expect(await screen.findByText('Relationship')).toBeInTheDocument();
    });

    it('renders a nested relationship node inside a relationship node', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              relationshipNode(
                'author',
                group('_and', [condition('title'), relationshipNode('posts')]),
              ),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('author')).toBeInTheDocument();
      expect(screen.getByText('posts')).toBeInTheDocument();
      expect(screen.getAllByText('Relationship')).toHaveLength(2);
    });

    it('renders an exists node inside a relationship node', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              relationshipNode(
                'author',
                group('_and', [
                  condition('title'),
                  existsNode('public', 'actor'),
                ]),
              ),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('author')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();
      expect(screen.getByText('public.actor')).toBeInTheDocument();
      expect(screen.getByText('Exists')).toBeInTheDocument();
    });

    it('renders a relationship node inside an exists node', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              existsNode(
                'public',
                'town',
                group('_and', [
                  condition('title'),
                  relationshipNode('customer'),
                ]),
              ),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('public.town')).toBeInTheDocument();
      expect(screen.getByText('Exists')).toBeInTheDocument();
      expect(screen.getByText('customer')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();
    });

    it('"Delete relationship" button is disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              relationshipNode('author'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      const deleteButton = screen.getByRole('button', {
        name: /delete relationship/i,
      });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('mixed node types at the same level (condition + group + exists + relationship) render correctly', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
              existsNode('public', 'town'),
              relationshipNode('author'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getByText('Exists')).toBeInTheDocument();
      expect(screen.getByText('public.town')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();
      expect(screen.getByText('author')).toBeInTheDocument();
    });

    it('renders an exists node inside a nested group node', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              group('_or', [condition('title'), existsNode('public', 'town')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getByText('Exists')).toBeInTheDocument();
      expect(screen.getByText('public.town')).toBeInTheDocument();
    });

    it('renders a relationship node inside a nested group node', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              group('_or', [condition('title'), relationshipNode('author')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();
      expect(screen.getByText('author')).toBeInTheDocument();
    });

    it('renders exists and relationship nodes inside deeply nested groups', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              group('_or', [
                group('_and', [
                  existsNode('public', 'town'),
                  relationshipNode('author'),
                ]),
              ]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('Exists')).toBeInTheDocument();
      expect(screen.getByText('public.town')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();
      expect(screen.getByText('author')).toBeInTheDocument();
    });

    it('rapid add/remove operations do not cause state inconsistencies', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();

      // Add 2 conditions via the popover
      await user.click(screen.getByText('Add'));
      await user.click(
        await screen.findByRole('option', { name: /release_date/ }),
      );
      await waitFor(() => {
        expect(screen.getByText('release_date')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Add'));
      await user.click(
        await screen.findByRole('option', { name: /author_id/ }),
      );
      await waitFor(() => {
        expect(screen.getByText('author_id')).toBeInTheDocument();
      });

      // Remove the last condition
      const removeButtons = screen.getAllByRole('button', {
        name: /delete condition/i,
      });
      await user.click(removeButtons[removeButtons.length - 1]);

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /delete condition/i }),
        ).toHaveLength(2);
        expect(screen.queryByText('author_id')).not.toBeInTheDocument();
        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('release_date')).toBeInTheDocument();
      });
    });

    it('_not operator with multiple children renders correctly', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_not', [
              condition('title'),
              condition('release_date'),
              condition('author_id'),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('NOT')).toBeInTheDocument();
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();
      expect(screen.getByText('author_id')).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: /delete condition/i }),
      ).toHaveLength(3);
    });
  });

  describe('empty state (root level)', () => {
    it('renders AddNodeButton when filter is an empty _implicit group', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_implicit', []),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      // AddNodeButton is present
      expect(
        screen.getByRole('button', { name: /add check/i }),
      ).toBeInTheDocument();
      // No group UI elements are rendered
      expect(screen.queryByText('AND')).not.toBeInTheDocument();
      expect(screen.queryByText('OR')).not.toBeInTheDocument();
      expect(screen.queryByText('NOT')).not.toBeInTheDocument();
      expect(screen.queryByText('Implicit')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /delete group/i }),
      ).not.toBeInTheDocument();
    });

    it('renders AddNodeButton when filter is an empty object', () => {
      render(
        <TestWrapper defaultValues={{ rule: {} }}>
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(
        screen.getByRole('button', { name: /add check/i }),
      ).toBeInTheDocument();
      // No group UI
      expect(screen.queryByText('AND')).not.toBeInTheDocument();
      expect(screen.queryByText('OR')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /delete group/i }),
      ).not.toBeInTheDocument();
    });

    it('renders GroupNodeRenderer (not AddNodeButton at root) when filter has content', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      // Group UI is rendered
      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /delete group/i }),
      ).toBeInTheDocument();
      // The root-level full-width "Add check" button should not be present
      expect(
        screen.queryByRole('button', { name: /add check/i }),
      ).not.toBeInTheDocument();
      // The group-level "Add" button should be present
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('selecting a condition from AddNodeButton at root wraps it in an _implicit group', async () => {
      render(
        <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /add check/i }));
      await user.click(await screen.findByRole('option', { name: /title/ }));

      await waitFor(() => {
        expect(screen.getByText('Implicit')).toBeInTheDocument();
        expect(screen.getByText('title')).toBeInTheDocument();
      });
    });

    it('selecting a group from AddNodeButton at root sets it directly as root (no _implicit wrapping)', async () => {
      render(
        <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /add check/i }));
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        expect(screen.getByText('AND')).toBeInTheDocument();
        expect(screen.queryByText('Implicit')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /add check/i }),
        ).not.toBeInTheDocument();
      });
    });

    it('selecting a relationship from AddNodeButton at root wraps it in an _implicit group', async () => {
      render(
        <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /add check/i }));
      await user.click(await screen.findByRole('option', { name: 'author' }));

      await waitFor(() => {
        expect(screen.getByText('Implicit')).toBeInTheDocument();
        expect(screen.getByText('Relationship')).toBeInTheDocument();
        expect(screen.getByText('author')).toBeInTheDocument();
      });
    });

    it('selecting exists from AddNodeButton at root wraps it in an _implicit group', async () => {
      render(
        <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /add check/i }));
      await user.click(await screen.findByRole('option', { name: 'exists' }));

      const existWrapper = screen.getAllByText('Implicit')[1];
      expect(existWrapper).toBeInTheDocument();
      expect(screen.getByText('Exists')).toBeInTheDocument();
      expect(screen.getByText('Select table...')).toBeInTheDocument();
    });
  });

  describe('root remove (reset to empty)', () => {
    it('clicking the root delete button resets to empty state with no group UI', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /delete group/i }));

      await waitFor(() => {
        expect(screen.queryByText('AND')).not.toBeInTheDocument();
        expect(screen.queryByText('title')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /delete group/i }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /add check/i }),
        ).toBeInTheDocument();
      });
    });

    it('after resetting to empty, selecting a new node works correctly', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByRole('button', { name: /delete group/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add check/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add check/i }));
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        expect(screen.getByText('AND')).toBeInTheDocument();
      });
    });
  });

  describe('empty groups (nested level)', () => {
    it('a newly added nested group renders AddNodeButton (full-width) inside it', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      // Add a nested group via the popover
      await user.click(screen.getByText('Add'));
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        // Root group AND + nested group AND
        expect(screen.getAllByText('AND')).toHaveLength(2);
        // Root group has one Add, nested empty group has one full-width Add
        const addButtons = screen.getAllByText('Add');
        expect(addButtons).toHaveLength(2);
      });
    });

    it('selecting a rule from AddNodeButton inside a nested group appends it directly', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      // Add a nested group first
      await user.click(screen.getByText('Add'));
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        expect(screen.getAllByText('AND')).toHaveLength(2);
      });

      // Click the nested group's Add button (first in DOM order)
      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);
      await user.click(await screen.findByRole('option', { name: /title/ }));

      await waitFor(() => {
        expect(screen.getAllByText('title')).toHaveLength(2);
        expect(
          screen.getAllByRole('button', { name: /delete condition/i }),
        ).toHaveLength(2);
      });
    });

    it('selecting a group from AddNodeButton inside a nested group appends it directly', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      // Add a nested group first
      await user.click(screen.getByText('Add'));
      await user.click(await screen.findByRole('option', { name: 'and' }));

      await waitFor(() => {
        expect(screen.getAllByText('AND')).toHaveLength(2);
      });

      // Click the nested group's Add button (first in DOM order)
      const addButtons = screen.getAllByText('Add');
      await user.click(addButtons[0]);
      await user.click(await screen.findByRole('option', { name: 'or' }));

      await waitFor(() => {
        expect(screen.getAllByText('AND')).toHaveLength(2);
        expect(screen.getByText('OR')).toBeInTheDocument();
      });
    });

    it('removing the last child from a nested group shows AddNodeButton inside it', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              condition('title'),
              group('_or', [condition('release_date')]),
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('release_date')).toBeInTheDocument();

      const user = new TestUserEvent();
      // Remove the condition inside the nested _or group
      const removeButtons = screen.getAllByRole('button', {
        name: /delete condition/i,
      });
      // The last trash button belongs to the nested condition
      await user.click(removeButtons[removeButtons.length - 1]);

      await waitFor(() => {
        // release_date removed, title remains
        expect(screen.queryByText('release_date')).not.toBeInTheDocument();
        expect(screen.getByText('title')).toBeInTheDocument();
        // The nested group still exists (OR badge) with an Add button inside
        expect(screen.getByText('OR')).toBeInTheDocument();
        // Root group Add + nested empty group Add
        expect(screen.getAllByText('Add')).toHaveLength(2);
      });
    });
  });

  describe('exists/relationship empty children', () => {
    it('a newly added exists node has an empty where clause that shows AddNodeButton', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));
      await user.click(await screen.findByRole('option', { name: 'exists' }));

      await waitFor(() => {
        expect(screen.getByText('Exists')).toBeInTheDocument();
        expect(screen.getByText('Select table...')).toBeInTheDocument();
        // Root group Add + exists where clause Add
        expect(screen.getAllByText('Add')).toHaveLength(2);
      });
    });

    it('a newly added relationship node has an empty child group that shows AddNodeButton', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      expect(await screen.findByText('title')).toBeInTheDocument();

      const user = new TestUserEvent();
      await user.click(screen.getByText('Add'));
      // Use exact match to avoid matching 'author_id' column
      await user.click(await screen.findByRole('option', { name: 'author' }));

      await waitFor(() => {
        expect(screen.getByText('Relationship')).toBeInTheDocument();
        expect(screen.getByText('author')).toBeInTheDocument();
        // Root group Add + relationship child group Add
        expect(screen.getAllByText('Add')).toHaveLength(2);
      });
    });
  });

  describe('node highlight styles', () => {
    it('group node container has hover and focus-within highlight classes', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const groupContainer = screen
        .getByText('AND')
        .closest('[class*="rounded-lg"]');
      expect(groupContainer?.className).toContain(
        '[&:hover:not(:has(.group-node:hover))]:ring-2',
      );
      expect(groupContainer?.className).toContain(
        '[&:hover:not(:has(.group-node:hover))]:ring-ring/50',
      );
      expect(groupContainer?.className).toContain(
        '[&:focus-within:not(:has(.group-node:focus-within))]:ring-2',
      );
      expect(groupContainer?.className).toContain(
        '[&:focus-within:not(:has(.group-node:focus-within))]:ring-ring/30',
      );
      expect(groupContainer?.className).toContain('transition-shadow');
    });

    it('condition row has hover and focus-within background highlight classes', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const conditionRow = screen
        .getByRole('button', { name: /delete condition/i })
        .closest('[class*="transition-colors"]');
      expect(conditionRow).not.toBeNull();
      expect(conditionRow?.className).toContain('hover:bg-accent');
      expect(conditionRow?.className).toContain('transition-colors');
    });

    it('exists node container has hover and focus-within highlight classes with blue ring', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              {
                type: 'exists',
                id: crypto.randomUUID(),
                schema: 'public',
                table: 'authors',
                where: group('_implicit', []),
              } satisfies ExistsNode,
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const existsLabel = screen.getByLabelText('Delete exists');
      const existsContainer = existsLabel.closest('[class*="bg-blue-50"]');
      expect(existsContainer?.className).toContain(
        '[&:hover:not(:has(.group-node:hover))]:ring-2',
      );
      expect(existsContainer?.className).toContain(
        '[&:hover:not(:has(.group-node:hover))]:ring-blue-400/30',
      );
      expect(existsContainer?.className).toContain(
        '[&:focus-within:not(:has(.group-node:focus-within))]:ring-2',
      );
      expect(existsContainer?.className).toContain(
        '[&:focus-within:not(:has(.group-node:focus-within))]:ring-blue-400/40',
      );
      expect(existsContainer?.className).toContain('transition-shadow');
    });

    it('relationship node container has hover and focus-within highlight classes with emerald ring', async () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [
              {
                type: 'relationship',
                id: crypto.randomUUID(),
                relationship: 'author',
                child: group('_implicit', []),
              } satisfies RelationshipNode,
            ]),
          }}
        >
          <CustomCheckEditor {...defaultProps} />
        </TestWrapper>,
      );

      const relationshipLabel = screen.getByLabelText('Delete relationship');
      const relationshipContainer = relationshipLabel.closest(
        '[class*="bg-emerald-50"]',
      );
      expect(relationshipContainer?.className).toContain(
        '[&:hover:not(:has(.group-node:hover))]:ring-2',
      );
      expect(relationshipContainer?.className).toContain(
        '[&:hover:not(:has(.group-node:hover))]:ring-emerald-400/30',
      );
      expect(relationshipContainer?.className).toContain(
        '[&:focus-within:not(:has(.group-node:focus-within))]:ring-2',
      );
      expect(relationshipContainer?.className).toContain(
        '[&:focus-within:not(:has(.group-node:focus-within))]:ring-emerald-400/40',
      );
      expect(relationshipContainer?.className).toContain('transition-shadow');
    });
  });

  describe('AddNodeButton disabled state', () => {
    it('AddNodeButton at root level is disabled when disabled prop is true', () => {
      render(
        <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      expect(screen.getByRole('button', { name: /add check/i })).toBeDisabled();
    });

    it('AddNodeButton inside nested groups is disabled when disabled prop is true', () => {
      render(
        <TestWrapper
          defaultValues={{
            rule: group('_and', [condition('title')]),
          }}
        >
          <CustomCheckEditor {...defaultProps} disabled />
        </TestWrapper>,
      );

      expect(screen.getByText('Add')).toBeDisabled();
    });
  });
});
