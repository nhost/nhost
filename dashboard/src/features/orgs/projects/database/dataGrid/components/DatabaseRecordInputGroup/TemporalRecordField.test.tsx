import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import serializeTemporalValue from '@/features/orgs/projects/database/dataGrid/utils/serializeTemporalValue/serializeTemporalValue';
import { render, screen, TestUserEvent, within } from '@/tests/testUtils';
import TemporalRecordField from './TemporalRecordField';

function getToggle(name: string) {
  return within(screen.getByRole('group')).getByRole('button', { name });
}

function ValueProbe() {
  const value = useWatch({ name: 'col' });
  return <div data-testid="value-probe">{JSON.stringify(value ?? null)}</div>;
}

function SerializedProbe({ baseType }: { baseType: string }) {
  const value = useWatch({ name: 'col' });
  return (
    <div data-testid="serialized">
      {String(serializeTemporalValue(value, baseType))}
    </div>
  );
}

function Wrapper({
  baseType = 'date',
  isNullable = false,
  hasDefault = false,
  placeholder,
  defaultValue = null,
}: {
  baseType?: string;
  isNullable?: boolean;
  hasDefault?: boolean;
  placeholder?: string;
  defaultValue?: string | null;
}) {
  const methods = useForm<{ col: string | null }>({
    defaultValues: { col: defaultValue },
  });

  return (
    <FormProvider {...methods}>
      <TemporalRecordField
        control={methods.control}
        name="col"
        label="Column"
        baseType={baseType}
        isNullable={isNullable}
        hasDefault={hasDefault}
        placeholder={placeholder}
      />
      <ValueProbe />
      <SerializedProbe baseType={baseType} />
      <button
        type="button"
        onClick={() =>
          methods.setError('col', { type: 'manual', message: 'err' })
        }
      >
        trigger error
      </button>
    </FormProvider>
  );
}

describe('TemporalRecordField', () => {
  it('renders only the picker for a required column', () => {
    render(<Wrapper baseType="date" defaultValue={null} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'NULL' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'DEFAULT' }),
    ).not.toBeInTheDocument();
  });

  it('emits null and shows the NULL label for a nullable column', async () => {
    render(<Wrapper baseType="date" isNullable defaultValue="2025-04-10" />);

    expect(
      screen.queryByRole('button', { name: 'DEFAULT' }),
    ).not.toBeInTheDocument();

    await new TestUserEvent().click(getToggle('NULL'));

    expect(screen.getByTestId('value-probe')).toHaveTextContent('null');
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'NULL');
    expect(getToggle('NULL')).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes the sentinel and shows the default placeholder for a column with a default', async () => {
    render(
      <Wrapper
        baseType="date"
        hasDefault
        placeholder="now()"
        defaultValue={null}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'NULL' }),
    ).not.toBeInTheDocument();

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'DEFAULT' }),
    );

    expect(screen.getByTestId('value-probe')).toHaveTextContent(
      JSON.stringify(POSTGRES_DEFAULT_PLACEHOLDER),
    );
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'placeholder',
      'now()',
    );
    expect(screen.getByRole('button', { name: 'DEFAULT' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders both buttons when the column is nullable and has a default', () => {
    render(
      <Wrapper
        baseType="date"
        isNullable
        hasDefault
        defaultValue={POSTGRES_DEFAULT_PLACEHOLDER}
      />,
    );

    expect(getToggle('NULL')).toBeInTheDocument();
    expect(getToggle('DEFAULT')).toBeInTheDocument();
  });

  it('clears the NULL state when a date is picked', async () => {
    render(<Wrapper baseType="date" isNullable defaultValue={null} />);
    const user = new TestUserEvent();

    expect(getToggle('NULL')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('13'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(getToggle('NULL')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('value-probe')).not.toHaveTextContent('null');
  });

  it('serializes the picked calendar day without shifting it', async () => {
    render(<Wrapper baseType="date" defaultValue="2025-04-10" />);
    const user = new TestUserEvent();

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('April 2025')).toBeInTheDocument();

    await user.click(screen.getByText('24'));
    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(screen.getByTestId('serialized')).toHaveTextContent('2025-04-24');
  });

  it('renders a destructive picker border when the field has an error', async () => {
    render(<Wrapper baseType="date" defaultValue={null} />);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'trigger error' }),
    );

    expect(screen.getByRole('combobox')).toHaveClass('border-destructive');
  });
});
