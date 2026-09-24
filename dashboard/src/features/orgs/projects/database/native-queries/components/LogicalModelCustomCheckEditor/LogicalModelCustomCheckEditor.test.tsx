import { yupResolver } from '@hookform/resolvers/yup';
import { setupServer } from 'msw/node';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  type GroupNode,
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
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const profile: LogicalModelItem = {
  name: 'profile',
  fields: [
    { name: 'active', type: { scalar: 'boolean', nullable: false } },
    { name: 'displayName', type: { scalar: 'citext', nullable: false } },
  ],
};
const model: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'bio', type: { scalar: 'character varying', nullable: true } },
    { name: 'profile', type: { logical_model: 'profile', nullable: true } },
  ],
};
const fields = resolveLogicalModelFieldDescriptors(model, [model, profile]);
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
  fieldResolution = fields,
  onSubmit = vi.fn(),
}: {
  filter: GroupNode;
  fieldResolution?: ReturnType<typeof resolveLogicalModelFieldDescriptors>;
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
            fields={fieldResolution}
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
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.setPointerCapture = vi.fn();
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

  afterEach(() => server.resetHandlers());
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
        fieldResolution={resolveLogicalModelFieldDescriptors(arrayModel, [
          arrayModel,
        ])}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add check' }));
    expect(screen.getByText('exists', { exact: true })).toBeInTheDocument();
  });

  it('adds a relationship as an empty group and offers its fields inside', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('id')} />);

    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    await user.click(await screen.findByRole('option', { name: /profile/ }));

    const tree = JSON.parse(
      screen.getByTestId('filter-tree').textContent ?? '{}',
    );
    expect(withoutIds(tree.children[1])).toEqual({
      type: 'relationship',
      relationship: 'profile',
      child: { type: 'group', operator: '_and', children: [] },
    });

    const [nestedAdd] = screen.getAllByRole('button', { name: 'Add' });
    await user.click(nestedAdd);
    expect(
      await screen.findByRole('option', { name: /displayName/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /profile/ }),
    ).not.toBeInTheDocument();
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
      screen.getByRole('option', { name: 'profile.active' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'profile.displayName' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /title/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'profile.active' }));

    const tree = JSON.parse(
      screen.getByTestId('filter-tree').textContent ?? '{}',
    ) as GroupNode;
    expect(tree.children[0]).toMatchObject({
      type: 'condition',
      operator: '_ceq',
      value: ['$', 'profile.active'],
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

  it('uses the normalized scalar operator family on every render', async () => {
    const user = new TestUserEvent();
    render(<TestForm filter={condition('bio')} />);

    await user.click(screen.getAllByRole('combobox')[1]);
    expect(screen.getByText('_like', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('_niregex', { exact: true })).toBeInTheDocument();
  });
});
