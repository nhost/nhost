import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
  LogicalOperator,
  RelationshipNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import JsonRuleEditor from './JsonRuleEditor';

function condition(
  column: string,
  operator: HasuraOperator = '_eq',
  value: unknown = null,
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
  children: ReactNode;
  defaultValues: Record<string, unknown>;
}) {
  const form = useForm({ defaultValues });
  return <FormProvider {...form}>{children}</FormProvider>;
}

describe('JsonRuleEditor', () => {
  it('renders {} when the filter is an empty _implicit group', () => {
    render(
      <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
        <JsonRuleEditor name="rule" />
      </TestWrapper>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('{}');
  });

  it('serializes a single-condition group to the Hasura JSON shape', () => {
    render(
      <TestWrapper
        defaultValues={{
          rule: group('_implicit', [condition('title', '_eq', 'foo')]),
        }}
      >
        <JsonRuleEditor name="rule" />
      </TestWrapper>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value)).toEqual({
      title: { _eq: 'foo' },
    });
  });

  it('serializes a nested _and/_or group to nested JSON', () => {
    render(
      <TestWrapper
        defaultValues={{
          rule: group('_and', [
            condition('title', '_eq', 'foo'),
            group('_or', [
              condition('release_date', '_gt', '2020-01-01'),
              condition('author_id', '_eq', 1),
            ]),
          ]),
        }}
      >
        <JsonRuleEditor name="rule" />
      </TestWrapper>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value)).toEqual({
      _and: [
        { title: { _eq: 'foo' } },
        {
          _or: [
            { release_date: { _gt: '2020-01-01' } },
            { author_id: { _eq: 1 } },
          ],
        },
      ],
    });
  });

  it('serializes an exists node to {_exists: {_table, _where}}', () => {
    render(
      <TestWrapper
        defaultValues={{
          rule: group('_implicit', [
            existsNode(
              'public',
              'authors',
              group('_implicit', [condition('id', '_eq', 1)]),
            ),
          ]),
        }}
      >
        <JsonRuleEditor name="rule" />
      </TestWrapper>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value)).toEqual({
      _exists: {
        _table: { schema: 'public', name: 'authors' },
        _where: { id: { _eq: 1 } },
      },
    });
  });

  it('serializes a relationship node to {<relationship>: {...}}', () => {
    render(
      <TestWrapper
        defaultValues={{
          rule: group('_implicit', [
            relationshipNode(
              'author',
              group('_implicit', [condition('name', '_eq', 'John')]),
            ),
          ]),
        }}
      >
        <JsonRuleEditor name="rule" />
      </TestWrapper>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value)).toEqual({
      author: { name: { _eq: 'John' } },
    });
  });

  it('preserves the user draft (whitespace) while typing', async () => {
    render(
      <TestWrapper defaultValues={{ rule: group('_implicit', []) }}>
        <JsonRuleEditor name="rule" />
      </TestWrapper>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const user = new TestUserEvent();
    await user.clear(textarea);
    await user.paste('{  "title":  {"_eq":  "foo"}  }');

    expect(textarea.value).toBe('{  "title":  {"_eq":  "foo"}  }');
  });
});
