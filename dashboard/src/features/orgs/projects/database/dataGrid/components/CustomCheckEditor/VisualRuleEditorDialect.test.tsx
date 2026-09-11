import { FormProvider, useForm } from 'react-hook-form';
import type { CustomCheckEditorDialect } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import VisualRuleEditor from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/VisualRuleEditor';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { render, screen } from '@/tests/testUtils';

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: () => {
      throw new Error('table schema hook must not run');
    },
  }),
);

vi.mock('@/features/orgs/projects/common/hooks/useExportMetadata', () => ({
  useExportMetadata: () => {
    throw new Error('export metadata hook must not run');
  },
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups',
  () => ({
    default: () => {
      throw new Error('column groups hook must not run');
    },
  }),
);

const fakeDialect: CustomCheckEditorDialect = {
  AddNode: ({ label = 'Add fake node' }) => (
    <button type="button">{label}</button>
  ),
  ConditionField: ({ name }) => <span>field:{name}</span>,
  ConditionOperator: ({ name }) => <span>operator:{name}</span>,
  ConditionValue: ({ name }) => <span>value:{name}</span>,
  GroupOperator: ({ name }) => <span>group:{name}</span>,
  ExistsNode: ({ name }) => <span>exists:{name}</span>,
  RelationshipNode: ({ name }) => <span>relationship:{name}</span>,
  UnsupportedNode: ({ name }) => <span>unsupported:{name}</span>,
};

function TestWrapper({
  children,
  rule,
}: {
  children: React.ReactNode;
  rule: RuleNode;
}) {
  const form = useForm({ defaultValues: { rule } });
  return <FormProvider {...form}>{children}</FormProvider>;
}

function condition(): RuleNode {
  return {
    type: 'condition',
    id: crypto.randomUUID(),
    column: 'title',
    operator: '_eq',
    value: 'Dune',
  };
}

describe('VisualRuleEditor dialect', () => {
  it('renders every injected node slot without invoking table hooks', () => {
    const rule: RuleNode = {
      type: 'group',
      id: crypto.randomUUID(),
      operator: '_and',
      children: [
        condition(),
        {
          type: 'group',
          id: crypto.randomUUID(),
          operator: '_or',
          children: [condition()],
        },
        {
          type: 'exists',
          id: crypto.randomUUID(),
          schema: 'public',
          table: 'authors',
          where: {
            type: 'group',
            id: crypto.randomUUID(),
            operator: '_implicit',
            children: [],
          },
        },
        {
          type: 'relationship',
          id: crypto.randomUUID(),
          relationship: 'author',
          child: {
            type: 'group',
            id: crypto.randomUUID(),
            operator: '_implicit',
            children: [],
          },
        },
        {
          type: 'invalid',
          id: crypto.randomUUID(),
          key: '_unsupported',
          raw: true,
          reason: 'operator',
        },
      ],
    };

    render(
      <TestWrapper rule={rule}>
        <VisualRuleEditor
          schema="unused"
          table="unused"
          name="rule"
          dialect={fakeDialect}
        />
      </TestWrapper>,
    );

    expect(screen.getByText('group:rule')).toBeInTheDocument();
    expect(screen.getByText('group:rule.children.1')).toBeInTheDocument();
    expect(screen.getByText('field:rule.children.0')).toBeInTheDocument();
    expect(screen.getByText('operator:rule.children.0')).toBeInTheDocument();
    expect(screen.getByText('value:rule.children.0')).toBeInTheDocument();
    expect(screen.getByText('exists:rule.children.2')).toBeInTheDocument();
    expect(
      screen.getByText('relationship:rule.children.3'),
    ).toBeInTheDocument();
    expect(screen.getByText('unsupported:rule.children.4')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(2);
  });
});
