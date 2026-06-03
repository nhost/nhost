import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { afterEach, vi } from 'vitest';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  type ComputedFieldFormValues,
  defaultComputedFieldValues,
} from './computedFieldFormTypes';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

mockPointerEvent();

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {
      orgSlug: 'test-org',
      appSubdomain: 'test-project',
      dataSourceSlug: 'default',
    },
  }),
}));

vi.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => (
    <pre data-testid="codemirror-mock">{value}</pre>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const TABLE: QualifiedTable = { name: 'users', schema: 'public' };

const usersRowArg = { schema: 'public', name: 'users', type: 'c' };

const FUNCTIONS: PostgresFunction[] = [
  {
    function_schema: 'public',
    function_name: 'compute_full_name',
    function_arguments: 'row public.users',
    function_definition:
      'CREATE OR REPLACE FUNCTION public.compute_full_name(row public.users)\n RETURNS text\n LANGUAGE sql\n STABLE\nAS $function$\n  SELECT row.first_name || $$ $$ || row.last_name\n$function$\n',
    input_arg_types: [usersRowArg],
  },
  {
    function_schema: 'public',
    function_name: 'calculate_age',
    function_arguments: 'row public.users',
    function_definition:
      'CREATE OR REPLACE FUNCTION public.calculate_age(row public.users)\n RETURNS integer\n LANGUAGE sql\n STABLE\nAS $function$\n  SELECT EXTRACT(YEAR FROM age(row.date_of_birth))::integer\n$function$\n',
    input_arg_types: [usersRowArg],
  },
  {
    function_schema: 'analytics',
    function_name: 'lifetime_value',
    function_arguments: 'row public.users',
    function_definition:
      'CREATE OR REPLACE FUNCTION analytics.lifetime_value(row public.users)\n RETURNS numeric\n LANGUAGE sql\n STABLE\nAS $function$\n  SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = row.id\n$function$\n',
    input_arg_types: [usersRowArg],
  },
];

const SCHEMAS = ['public', 'analytics', 'auth', 'storage'];

interface TestWrapperProps {
  defaultValues?: Partial<ComputedFieldFormValues>;
  functions?: PostgresFunction[];
  schemas?: string[];
  table?: QualifiedTable;
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
  formRef?: { current: UseFormReturn<ComputedFieldFormValues> | null };
}

function TestWrapper({
  defaultValues,
  functions = FUNCTIONS,
  schemas = SCHEMAS,
  table = TABLE,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
  formRef,
}: TestWrapperProps) {
  const form = useForm<ComputedFieldFormValues>({
    defaultValues: { ...defaultComputedFieldValues, ...defaultValues },
  });
  if (formRef) {
    formRef.current = form;
  }
  return (
    <FormProvider {...form}>
      <ComputedFieldFormFields
        functions={functions}
        schemas={schemas}
        table={table}
        isFunctionsLoading={isFunctionsLoading}
        isSchemasLoading={isSchemasLoading}
        disabled={disabled}
      />
    </FormProvider>
  );
}

describe('ComputedFieldFormFields', () => {
  it('enables the name input by default', () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText('Computed Field Name')).not.toBeDisabled();
  });

  it('keeps the name input editable when a field already has a name', () => {
    render(
      <TestWrapper
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    expect(screen.getByLabelText('Computed Field Name')).not.toBeDisabled();
  });

  it('disables the function combobox until a schema is selected', () => {
    render(<TestWrapper />);

    const functionCombobox = screen.getByRole('combobox', {
      name: 'Function Name',
    });
    expect(functionCombobox).toBeDisabled();
    expect(functionCombobox).toHaveTextContent('Select a schema first');
  });

  it('enables the function combobox once a schema is selected', () => {
    render(<TestWrapper defaultValues={{ functionSchema: 'public' }} />);

    const functionCombobox = screen.getByRole('combobox', {
      name: 'Function Name',
    });
    expect(functionCombobox).not.toBeDisabled();
    expect(functionCombobox).toHaveTextContent('Select a function');
  });

  it('renders all six fields with their labels', () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText('Computed Field Name')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Function Schema' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Function Name' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Table Row Argument')).toBeInTheDocument();
    expect(screen.getByLabelText('Session Argument')).toBeInTheDocument();
    expect(screen.getByLabelText('Comment')).toBeInTheDocument();
  });

  it('shows the function reference in the comment placeholder when both schema and function are set', () => {
    render(
      <TestWrapper
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    expect(screen.getByLabelText('Comment')).toHaveAttribute(
      'placeholder',
      'Executes function public.compute_full_name',
    );
  });

  it('clears the function name when the user selects a schema that does not contain it', async () => {
    const formRef: TestWrapperProps['formRef'] = { current: null };
    const user = new TestUserEvent();

    render(
      <TestWrapper
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
        formRef={formRef}
      />,
    );

    expect(formRef.current?.getValues('functionName')).toBe(
      'compute_full_name',
    );

    await user.click(screen.getByRole('combobox', { name: 'Function Schema' }));
    await user.click(await screen.findByRole('option', { name: 'analytics' }));

    await waitFor(() => {
      expect(formRef.current?.getValues('functionName')).toBe('');
    });
  });

  it('disables every field when the disabled prop is set', () => {
    render(
      <TestWrapper disabled defaultValues={{ functionSchema: 'public' }} />,
    );

    expect(screen.getByLabelText('Computed Field Name')).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Function Schema' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Function Name' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Table Row Argument')).toBeDisabled();
    expect(screen.getByLabelText('Session Argument')).toBeDisabled();
    expect(screen.getByLabelText('Comment')).toBeDisabled();
  });

  it('hides the Create Function action until the user types a search query', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper defaultValues={{ functionSchema: 'public' }} />);

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));

    expect(
      screen.queryByTestId('computed-field-new-function-action'),
    ).not.toBeInTheDocument();
  });

  it('renders the Create Function action with the typed name once the user types', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper defaultValues={{ functionSchema: 'public' }} />);

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));
    await user.type(
      screen.getByPlaceholderText('Search or type a new function name...'),
      'compute_my_thing',
    );

    const createAction = await screen.findByTestId(
      'computed-field-new-function-action',
    );
    expect(createAction).toBeInTheDocument();
    expect(createAction).toHaveTextContent(
      'Create function "compute_my_thing"',
    );
  });

  it('opens the SQL editor with the typed function name and commits it to the form when Create Function is clicked', async () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null as unknown as Window);
    const formRef: TestWrapperProps['formRef'] = { current: null };
    const user = new TestUserEvent();

    render(
      <TestWrapper
        defaultValues={{ functionSchema: 'public' }}
        formRef={formRef}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));
    await user.type(
      screen.getByPlaceholderText('Search or type a new function name...'),
      'compute_my_thing',
    );
    await user.click(
      await screen.findByTestId('computed-field-new-function-action'),
    );

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, target, features] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(String(calledUrl)).toMatch(
      /^\/orgs\/test-org\/projects\/test-project\/database\/browser\/default\/editor\?sql=/,
    );

    const decodedSql = decodeURIComponent(
      String(calledUrl).split('?sql=')[1] ?? '',
    );
    expect(decodedSql).toContain(
      'CREATE OR REPLACE FUNCTION public.compute_my_thing(user_row public.users)',
    );
    expect(decodedSql).toContain(
      'The first argument "user_row" must accept a row of "public.users".',
    );

    expect(formRef.current?.getValues('functionName')).toBe('compute_my_thing');
  });

  it('uses the table schema in the SQL template when the function schema differs', async () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null as unknown as Window);
    const user = new TestUserEvent();

    render(
      <TestWrapper
        table={{ name: 'users', schema: 'public' }}
        defaultValues={{ functionSchema: 'analytics' }}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Function Name' }));
    await user.type(
      screen.getByPlaceholderText('Search or type a new function name...'),
      'lifetime_payments',
    );
    await user.click(
      await screen.findByTestId('computed-field-new-function-action'),
    );

    const calledUrl = String(openSpy.mock.calls[0][0]);
    const decodedSql = decodeURIComponent(calledUrl.split('?sql=')[1] ?? '');
    expect(decodedSql).toContain(
      'CREATE OR REPLACE FUNCTION analytics.lifetime_payments(user_row public.users)',
    );
  });

  it('does not show the function definition preview until a function is selected', () => {
    render(<TestWrapper defaultValues={{ functionSchema: 'public' }} />);

    expect(
      screen.queryByTestId('function-definition-preview-toggle'),
    ).not.toBeInTheDocument();
  });

  it('shows the function definition preview, expanded by default, with the schema-qualified name', () => {
    render(
      <TestWrapper
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    const toggle = screen.getByTestId('function-definition-preview-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Function definition');
    expect(toggle).toHaveTextContent('public.compute_full_name');
    expect(
      screen.getByTestId('function-definition-preview-code'),
    ).toBeInTheDocument();
  });

  it('collapses the preview when the toggle is clicked', async () => {
    const user = new TestUserEvent();

    render(
      <TestWrapper
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    const toggle = screen.getByTestId('function-definition-preview-toggle');
    expect(
      screen.getByTestId('function-definition-preview-code'),
    ).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('function-definition-preview-code'),
    ).not.toBeInTheDocument();
  });

  it('opens the SQL editor in a new tab with the function definition when Edit in SQL Editor is clicked', async () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null as unknown as Window);
    const user = new TestUserEvent();

    render(
      <TestWrapper
        defaultValues={{
          name: 'full_name',
          functionSchema: 'public',
          functionName: 'compute_full_name',
        }}
      />,
    );

    await user.click(screen.getByTestId('function-definition-preview-edit'));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, target, features] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');

    const decodedSql = decodeURIComponent(
      String(calledUrl).split('?sql=')[1] ?? '',
    );
    expect(decodedSql).toContain(
      'CREATE OR REPLACE FUNCTION public.compute_full_name(row public.users)',
    );
    expect(decodedSql).toContain(
      'SELECT row.first_name || $$ $$ || row.last_name',
    );
  });
});
