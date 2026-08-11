import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import NullDefaultToggleField from './NullDefaultToggleField';

function ValueProbe() {
  const value = useWatch({ name: 'col' });
  return <div data-testid="value-probe">{JSON.stringify(value ?? null)}</div>;
}

function Wrapper({
  defaultValue = POSTGRES_DEFAULT_PLACEHOLDER,
  placeholder,
}: {
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const methods = useForm({ defaultValues: { col: defaultValue } });
  return (
    <FormProvider {...methods}>
      <NullDefaultToggleField
        control={methods.control}
        name="col"
        label="Column"
        placeholder={placeholder}
      />
      <ValueProbe />
    </FormProvider>
  );
}

describe('NullDefaultToggleField', () => {
  it('always renders both NULL and DEFAULT buttons', () => {
    render(<Wrapper defaultValue={POSTGRES_DEFAULT_PLACEHOLDER} />);
    expect(screen.getByRole('button', { name: 'NULL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DEFAULT' })).toBeInTheDocument();
  });

  it('shows NULL placeholder and empty value after clicking NULL', async () => {
    render(<Wrapper />);
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'NULL' }),
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('placeholder', 'NULL');
    expect(screen.getByTestId('value-probe')).toHaveTextContent('null');
  });

  it('writes the sentinel after clicking DEFAULT and shows the column default placeholder', async () => {
    render(<Wrapper defaultValue={null} placeholder="some_default" />);
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'DEFAULT' }),
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('placeholder', 'some_default');
    expect(screen.getByTestId('value-probe')).toHaveTextContent(
      JSON.stringify(POSTGRES_DEFAULT_PLACEHOLDER),
    );
  });

  it('writes a literal empty string when the user clears a typed value', async () => {
    const user = new TestUserEvent();
    render(<Wrapper defaultValue="hello" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.clear(input);
    expect(input.value).toBe('');
    expect(screen.getByTestId('value-probe')).toHaveTextContent('""');
  });

  it('writes the typed value verbatim', async () => {
    const user = new TestUserEvent();
    render(<Wrapper defaultValue={null} />);
    await user.type(screen.getByRole('textbox'), 'hello');
    expect(screen.getByTestId('value-probe')).toHaveTextContent('"hello"');
  });

  it('marks DEFAULT as pressed when the field holds the sentinel', () => {
    render(<Wrapper defaultValue={POSTGRES_DEFAULT_PLACEHOLDER} />);
    expect(screen.getByRole('button', { name: 'DEFAULT' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'NULL' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks NULL as pressed when the field is null', () => {
    render(<Wrapper defaultValue={null} />);
    expect(screen.getByRole('button', { name: 'NULL' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'DEFAULT' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
