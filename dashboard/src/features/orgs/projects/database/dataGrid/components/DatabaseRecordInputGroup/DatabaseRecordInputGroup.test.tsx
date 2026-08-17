import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import DatabaseRecordInputGroup from './DatabaseRecordInputGroup';

function makeColumn(
  overrides: Partial<DataBrowserColumnMetadata> = {},
): DataBrowserColumnMetadata {
  return {
    id: 'col',
    specificType: 'text',
    baseType: 'text',
    isArray: false,
    displayType: 'text',
    isNullable: false,
    ...overrides,
  };
}

function ValueProbe() {
  const value = useWatch({ name: 'col' });
  return <div data-testid="value-probe">{JSON.stringify(value ?? null)}</div>;
}

function Wrapper({
  column = makeColumn(),
  defaultValue = null,
}: {
  column?: DataBrowserColumnMetadata;
  defaultValue?: string | null;
}) {
  const methods = useForm({ defaultValues: { col: defaultValue } });

  return (
    <FormProvider {...methods}>
      <DatabaseRecordInputGroup columns={[column]} />
      <ValueProbe />
    </FormProvider>
  );
}

describe('DatabaseRecordInputGroup', () => {
  it('hides the default sentinel in normal inputs', () => {
    render(
      <Wrapper
        column={makeColumn({ defaultValue: "'Untitled'" })}
        defaultValue={POSTGRES_DEFAULT_PLACEHOLDER}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toHaveAttribute(
      'placeholder',
      "Automatically generated value: 'Untitled'",
    );
    expect(screen.getByTestId('value-probe')).toHaveTextContent(
      JSON.stringify(POSTGRES_DEFAULT_PLACEHOLDER),
    );
  });

  it('writes the default sentinel when clearing a normal input with a default', async () => {
    const user = new TestUserEvent();
    render(
      <Wrapper
        column={makeColumn({ defaultValue: "'Untitled'" })}
        defaultValue="custom"
      />,
    );

    await user.clear(screen.getByRole('textbox'));

    expect(screen.getByTestId('value-probe')).toHaveTextContent(
      JSON.stringify(POSTGRES_DEFAULT_PLACEHOLDER),
    );
  });

  it('writes null when clearing a normal input without a default', async () => {
    const user = new TestUserEvent();
    render(<Wrapper defaultValue="custom" />);

    await user.clear(screen.getByRole('textbox'));

    expect(screen.getByTestId('value-probe')).toHaveTextContent('null');
  });
});
