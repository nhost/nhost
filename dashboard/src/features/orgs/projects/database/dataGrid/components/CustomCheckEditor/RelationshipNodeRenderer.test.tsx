import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  ConditionNode,
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
import { mockPointerEvent, render, screen } from '@/tests/testUtils';
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
  return { type: 'group', id: crypto.randomUUID(), operator, children };
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
  children: ReactNode;
  defaultValues: Record<string, unknown>;
}) {
  const form = useForm({ defaultValues });
  return <FormProvider {...form}>{children}</FormProvider>;
}

describe('RelationshipNodeRenderer - nested context propagation', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
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

  it('condition inside a relationship node uses the resolved relationship table as context', async () => {
    render(
      <TestWrapper
        defaultValues={{
          rule: group('_and', [
            condition('title'),
            relationshipNode('author', group('_and', [condition('name')])),
          ]),
        }}
      >
        <CustomCheckEditor schema="public" table="books" name="rule" />
      </TestWrapper>,
    );

    // Root condition resolves 'title' from the books table
    expect(await screen.findByText('title')).toBeInTheDocument();
    // Condition inside the 'author' relationship resolves 'name' from the authors table
    expect(await screen.findByText('name')).toBeInTheDocument();
  });

  it('nested relationship node uses the outer relationship resolved table as context', async () => {
    render(
      <TestWrapper
        defaultValues={{
          rule: group('_and', [
            relationshipNode(
              'author',
              group('_and', [
                condition('name'),
                relationshipNode('books', group('_and', [condition('title')])),
              ]),
            ),
          ]),
        }}
      >
        <CustomCheckEditor schema="public" table="books" name="rule" />
      </TestWrapper>,
    );

    // Condition inside 'author' relationship resolves 'name' from the authors table
    expect(await screen.findByText('name')).toBeInTheDocument();
    // Condition inside the nested 'books' relationship resolves 'title' from the books table
    expect(await screen.findByText('title')).toBeInTheDocument();
  });
});
