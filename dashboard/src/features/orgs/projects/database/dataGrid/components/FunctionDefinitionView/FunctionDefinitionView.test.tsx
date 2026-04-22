import { vi } from 'vitest';
import type { FetchFunctionDefinitionReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { render, screen } from '@/tests/testUtils';
import FunctionDefinitionView from './FunctionDefinitionView';

type FunctionMetadata = NonNullable<
  FetchFunctionDefinitionReturnType['functionMetadata']
>;

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useFunctionQuery: vi.fn(),
  useIsTrackedFunction: vi.fn(),
  useFunctionCustomizationQuery: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery',
  () => ({
    useFunctionQuery: mocks.useFunctionQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedFunction',
  () => ({
    useIsTrackedFunction: mocks.useIsTrackedFunction,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery',
  () => ({
    useFunctionCustomizationQuery: mocks.useFunctionCustomizationQuery,
  }),
);

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="codemirror">{value}</div>
  ),
}));

function meta(overrides: Partial<FunctionMetadata> = {}): FunctionMetadata {
  return {
    functionName: 'my_fn',
    functionSchema: 'public',
    functionType: 'VOLATILE',
    returnTypeName: 'mytable',
    returnTypeSchema: 'public',
    returnTypeKind: 'c',
    returnsSet: true,
    hasVariadic: false,
    language: 'sql',
    parameters: [],
    defaultArgsCount: 0,
    returnTableName: 'mytable',
    returnTableSchema: 'public',
    comment: null,
    ...overrides,
  };
}

function renderWith({
  functionMetadata,
  functionDefinition = '',
}: {
  functionMetadata: FunctionMetadata | null;
  functionDefinition?: string;
}) {
  mocks.useFunctionQuery.mockReturnValue({
    data: { functionMetadata, functionDefinition, error: null },
    status: 'success',
    error: null,
  });
  render(<FunctionDefinitionView />);
}

describe('FunctionDefinitionView', () => {
  beforeEach(() => {
    mocks.useRouter.mockReturnValue({
      query: {
        schemaSlug: 'public',
        functionOID: '1',
        dataSourceSlug: 'default',
      },
    });
    mocks.useIsTrackedFunction.mockReturnValue({ data: false });
    mocks.useFunctionCustomizationQuery.mockReturnValue({ data: null });
  });

  it('shows no non-exposable alert for a trackable composite-returning function', () => {
    renderWith({ functionMetadata: meta() });
    expect(
      screen.queryByText('Not exposable in GraphQL'),
    ).not.toBeInTheDocument();
  });

  it('shows the VARIADIC alert and badge when the function has a variadic argument', () => {
    renderWith({ functionMetadata: meta({ hasVariadic: true }) });
    expect(screen.getByText('Not exposable in GraphQL')).toBeInTheDocument();
    expect(screen.getByText(/uses VARIADIC arguments/)).toBeInTheDocument();
  });

  it('shows the non-composite alert when the return type is not composite', () => {
    renderWith({
      functionMetadata: meta({
        returnTypeKind: 'e',
        returnTypeName: 'mood',
        returnTableName: null,
        returnTableSchema: null,
      }),
    });
    expect(screen.getByText('Not exposable in GraphQL')).toBeInTheDocument();
    expect(screen.getByText(/"mood"/)).toBeInTheDocument();
  });

  it('omits the SETOF prefix when returnsSet is false', () => {
    renderWith({ functionMetadata: meta({ returnsSet: false }) });
    expect(screen.queryByText(/SETOF/)).not.toBeInTheDocument();
  });

  it('renders the source definition panel with an Edit button when a definition is present', () => {
    renderWith({
      functionMetadata: meta(),
      functionDefinition: 'CREATE FUNCTION my_fn() ...',
    });
    expect(screen.getByText('Source Definition')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders the "Function not found" empty state when metadata is null', () => {
    renderWith({ functionMetadata: null });
    expect(screen.getByText('Function not found')).toBeInTheDocument();
    expect(
      screen.getByText('The function does not exist.'),
    ).toBeInTheDocument();
  });
});
