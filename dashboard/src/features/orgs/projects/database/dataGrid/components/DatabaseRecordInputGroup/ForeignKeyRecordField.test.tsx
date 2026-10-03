import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import ForeignKeyRecordField from './ForeignKeyRecordField';

mockPointerEvent();

const mockUseTableQuery = vi.fn();

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/useTableQuery',
  () => ({
    default: (...args: unknown[]) => mockUseTableQuery(...args),
  }),
);

const defaultRelation: ForeignKeyRelation = {
  columnName: 'author_id',
  referencedSchema: 'public',
  referencedTable: 'authors',
  referencedColumn: 'id',
  updateAction: 'CASCADE',
  deleteAction: 'CASCADE',
};

function ValueProbe() {
  const value = useWatch({ name: 'author_id' });
  return <div data-testid="value-probe">{JSON.stringify(value ?? null)}</div>;
}

function Wrapper({
  relation = defaultRelation,
  isNullable = false,
  hasDefault = false,
  placeholder,
  defaultValue = null,
}: {
  relation?: ForeignKeyRelation;
  isNullable?: boolean;
  hasDefault?: boolean;
  placeholder?: string;
  defaultValue?: string | null;
}) {
  const methods = useForm<{ author_id: string | null }>({
    defaultValues: { author_id: defaultValue },
  });

  return (
    <FormProvider {...methods}>
      <ForeignKeyRecordField
        control={methods.control}
        name="author_id"
        label="Author"
        foreignKeyRelation={relation}
        isNullable={isNullable}
        hasDefault={hasDefault}
        placeholder={placeholder}
      />
      <ValueProbe />
    </FormProvider>
  );
}

describe('ForeignKeyRecordField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTableQuery.mockReturnValue({
      data: {
        rows: [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ],
      },
      isLoading: false,
    });
  });

  it('renders the free combobox for foreign key column', () => {
    render(<Wrapper />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent(
      'Select or enter authors.id...',
    );
    expect(
      screen.queryByRole('button', { name: 'NULL' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'DEFAULT' }),
    ).not.toBeInTheDocument();
  });

  it('allows picking a foreign key option from the combobox', async () => {
    const user = new TestUserEvent();
    render(<Wrapper />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '1 (Alice)' }));

    expect(screen.getByTestId('value-probe')).toHaveTextContent('"1"');
  });

  it('renders NULL toggle button and sets value to null when clicked', async () => {
    const user = new TestUserEvent();
    render(<Wrapper isNullable defaultValue="1" />);

    const nullButton = screen.getByRole('button', { name: 'NULL' });
    expect(nullButton).toBeInTheDocument();

    await user.click(nullButton);

    expect(screen.getByTestId('value-probe')).toHaveTextContent('null');
    expect(nullButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders DEFAULT toggle button and sets placeholder sentinel when clicked', async () => {
    const user = new TestUserEvent();
    render(<Wrapper hasDefault defaultValue="1" />);

    const defaultButton = screen.getByRole('button', { name: 'DEFAULT' });
    expect(defaultButton).toBeInTheDocument();

    await user.click(defaultButton);

    expect(screen.getByTestId('value-probe')).toHaveTextContent(
      JSON.stringify(POSTGRES_DEFAULT_PLACEHOLDER),
    );
    expect(defaultButton).toHaveAttribute('aria-pressed', 'true');
  });
});
