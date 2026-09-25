import { yupResolver } from '@hookform/resolvers/yup';
import { setupServer } from 'msw/node';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  type ConditionNode,
  type GroupNode,
  type LogicalOperator,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import {
  LogicalModelCustomCheckEditor,
  LogicalModelCustomCheckEditorProvider,
  LogicalModelCustomCheckModeToggle,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditor';
import validationSchema from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/validationSchema';
import { resolveLogicalModelFieldDescriptors } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const model: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'bio', type: { scalar: 'character varying', nullable: true } },
    { name: 'profile', type: { logical_model: 'profile', nullable: true } },
  ],
};
const fields = resolveLogicalModelFieldDescriptors(model);
const server = setupServer(
  tokenQuery,
  tableQuery,
  hasuraMetadataQuery,
  getProjectQuery,
  permissionVariablesQuery,
);

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

interface TestValues {
  rowCheckType: 'custom';
  columns: string[];
  filter: GroupNode;
}

function condition(
  column: string,
  operator: HasuraOperator = '_eq',
  value: unknown = 'value',
): GroupNode {
  return {
    type: 'group',
    id: 'root',
    operator: '_implicit',
    children: [
      {
        type: 'condition',
        id: 'condition',
        column,
        operator,
        value,
      },
    ],
  };
}

function emptyGroup(): GroupNode {
  return {
    type: 'group',
    id: 'root',
    operator: '_implicit',
    children: [],
  };
}

function conditionNode(
  column: string,
  operator: HasuraOperator = '_eq',
  value: unknown = 'value',
): ConditionNode {
  return {
    type: 'condition',
    id: `condition-${column}`,
    column,
    operator,
    value,
  };
}

function group(
  operator: LogicalOperator,
  children: GroupNode['children'],
  id = `group-${operator}`,
): GroupNode {
  return { type: 'group', id, operator, children };
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutIds);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, item]) => [key, withoutIds(item)]),
    );
  }
  return value;
}

function TestForm({
  filter,
  fieldDescriptors = fields,
  onSubmit = vi.fn(),
}: {
  filter: GroupNode;
  fieldDescriptors?: ReturnType<typeof resolveLogicalModelFieldDescriptors>;
  onSubmit?: (values: TestValues) => void;
}) {
  const form = useForm<TestValues>({
    defaultValues: {
      rowCheckType: 'custom',
      columns: ['id'],
      filter,
    },
    resolver: yupResolver(validationSchema) as unknown as Resolver<TestValues>,
  });
  const currentFilter = form.watch('filter');

  return (
    <FormProvider {...form}>
      <LogicalModelCustomCheckEditorProvider defaultMode="builder">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <LogicalModelCustomCheckModeToggle />
          <LogicalModelCustomCheckEditor
            name="filter"
            fields={fieldDescriptors}
          />
          <button type="submit">Save</button>
          <output data-testid="filter-tree">
            {JSON.stringify(currentFilter)}
          </output>
        </form>
      </LogicalModelCustomCheckEditorProvider>
    </FormProvider>
  );
}

describe('LogicalModelCustomCheckEditor', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
    server.listen();
    mockScrollIntoViewAndPointerCapture();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
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
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  it('offers exists when no scalar fields are selectable', async () => {
    const user = new TestUserEvent();
    const arrayModel: LogicalModelItem = {
      name: 'array_only',
      fields: [
        {
          name: 'tags',
          type: {
            array: { scalar: 'text', nullable: false },
            nullable: false,
          },
        },
      ],
    };
    render(
      <TestForm
        filter={emptyGroup()}
        fieldDescriptors={resolveLogicalModelFieldDescriptors(arrayModel)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add check' }));
    expect(screen.getByText('exists', { exact: true })).toBeInTheDocument();
  });

  it('offers only root scalar fields in the add menu', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('id')} />);

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(
      await screen.findByRole('option', { name: /id/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /bio/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /profile/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Relationships')).not.toBeInTheDocument();
  });

  it('shows a JSON nested field as non-editable and lets it be deleted', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('id')} />);

    await user.click(screen.getByRole('button', { name: 'JSON' }));
    await user.clear(screen.getByRole('textbox'));
    await user.paste(JSON.stringify({ profile: { active: { _eq: true } } }));
    await user.click(screen.getByRole('button', { name: 'Visual' }));

    expect(
      screen.getByText(
        /Nested fields aren't supported in logical model permissions/,
      ),
    ).toHaveTextContent('profile');
    expect(
      screen.queryByRole('combobox', { name: 'Logical model field' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete nested field' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Delete nested field' }),
    );
    expect(
      screen.queryByText(/Nested fields aren't supported/),
    ).not.toBeInTheDocument();
    expect(
      serializeNode(
        JSON.parse(screen.getByTestId('filter-tree').textContent ?? '{}'),
      ),
    ).toEqual({});
  });

  it('uses the shared table editor inside exists', async () => {
    const user = new TestUserEvent();
    render(
      <TestForm
        filter={{
          type: 'group',
          id: 'root',
          operator: '_implicit',
          children: [
            {
              type: 'exists',
              id: 'exists',
              schema: 'public',
              table: 'books',
              where: emptyGroup(),
            },
          ],
        }}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(
      await screen.findByRole('option', { name: /title/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'author' }),
    ).toBeInTheDocument();
  });

  it('uses the logical-model field picker for column comparisons and round-trips its value', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('id')} />);

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(screen.getByText('_ceq', { exact: true }));

    const comparisonField = screen.getByRole('combobox', {
      name: 'Logical model comparison field',
    });
    expect(
      screen.queryByRole('combobox', { name: 'Select a column' }),
    ).not.toBeInTheDocument();

    await user.click(comparisonField);
    expect(screen.getByRole('option', { name: 'id' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'bio' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /profile/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /title/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'bio' }));

    const tree = JSON.parse(
      screen.getByTestId('filter-tree').textContent ?? '{}',
    ) as GroupNode;
    expect(tree.children[0]).toMatchObject({
      type: 'condition',
      operator: '_ceq',
      value: ['$', 'bio'],
    });
    const reparsed = wrapPermissionsInAGroup(serializeNode(tree));
    expect(withoutIds(reparsed)).toEqual(withoutIds(tree));
  });

  it('shows a condition validation error inline in Visual mode and in the JSON summary', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('id', '_eq', null)} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Please enter a value.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'id _eq: Please enter a value.',
    );
  });

  it('shows a column comparison validation error inline in Visual mode', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('id', '_ceq', null)} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Please enter a value.'),
    ).toBeInTheDocument();
  });

  it('shows a missing column validation error inline', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('', '_eq', 'value')} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Please select a column.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['bare string', 'id'],
    ['same-scope array', ['id']],
    ['root-relative array', ['$', 'id']],
  ])('displays a stored %s column comparison reference', (_label, value) => {
    render(<TestForm filter={condition('id', '_ceq', value)} />);

    const visual = screen.getByRole('button', { name: 'Visual' });
    expect(visual).toBeEnabled();
    expect(visual).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('combobox', {
        name: 'Logical model comparison field',
      }),
    ).toHaveTextContent('id');
  });

  describe('validation error display', () => {
    const emptyGroupMessage = 'Add a condition or remove this empty group.';

    it('shows a nested empty-group error only inside the offending visual group', async () => {
      const user = new TestUserEvent();
      const onSubmit = vi.fn();
      render(
        <TestForm
          filter={group(
            '_or',
            [group('_and', []), conditionNode('id')],
            'root',
          )}
          onSubmit={onSubmit}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getAllByText(emptyGroupMessage)).toHaveLength(1);
      });
      expect(screen.getByText('AND').closest('.group-node')).toContainElement(
        screen.getByRole('alert'),
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows a nested empty-group error in the JSON summary', async () => {
      const user = new TestUserEvent();
      render(
        <TestForm
          filter={group(
            '_or',
            [group('_and', []), conditionNode('id')],
            'root',
          )}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'JSON' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByRole('listitem')).toHaveTextContent(
          emptyGroupMessage,
        );
      });
      expect(screen.getAllByText(emptyGroupMessage)).toHaveLength(1);
    });

    it('renders repeated errors without duplicate keys after switching from Visual to JSON', async () => {
      const user = new TestUserEvent();
      const consoleError = vi.spyOn(console, 'error');
      render(
        <TestForm
          filter={group(
            '_or',
            [group('_and', []), group('_or', []), conditionNode('id')],
            'root',
          )}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Save' }));
      await user.click(screen.getByRole('button', { name: 'JSON' }));

      await waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
      });
      expect(screen.getAllByText(emptyGroupMessage)).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('same key'),
        expect.any(String),
      );
    });

    it('keeps the empty-root error in the visual summary only', async () => {
      const emptyRootMessage =
        'Please add at least one rule, or choose "Without any checks".';
      const user = new TestUserEvent();
      render(
        <TestForm filter={group('_implicit', [group('_and', [])], 'root')} />,
      );

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByRole('listitem')).toHaveTextContent(
          emptyRootMessage,
        );
      });
      expect(screen.getAllByText(emptyRootMessage)).toHaveLength(1);
    });

    it('keeps serialization collision errors in the visual summary', async () => {
      const user = new TestUserEvent();
      render(
        <TestForm
          filter={group(
            '_implicit',
            [
              conditionNode('id', '_eq', 'foo'),
              { ...conditionNode('id', '_eq', 'bar'), id: 'duplicate' },
            ],
            'root',
          )}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByRole('listitem')).toHaveTextContent(
          /Column "id".*appears more than once/,
        );
      });
      expect(screen.getAllByText(/appears more than once/)).toHaveLength(1);
    });
  });

  it('uses the normalized scalar operator family on every render', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('bio')} />);

    await user.click(screen.getAllByRole('combobox')[1]);
    expect(screen.getByText('_like', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('_niregex', { exact: true })).toBeInTheDocument();
  });
});
