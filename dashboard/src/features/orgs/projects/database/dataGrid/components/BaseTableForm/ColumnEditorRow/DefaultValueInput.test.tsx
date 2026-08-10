import { FormProvider, useForm, useWatch } from 'react-hook-form';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import DefaultValueInput from './DefaultValueInput';

mockPointerEvent();

interface WrapperProps {
  type?: string | null;
  isNullable?: boolean;
  isGenerated?: boolean;
  generationExpression?: string | null;
  defaultValue?: string | null;
  identityColumnIndex?: number | null;
}

function Wrapper({
  type = 'text',
  isNullable = true,
  isGenerated = false,
  generationExpression = null,
  defaultValue = null,
  identityColumnIndex = null,
}: WrapperProps) {
  const form = useForm({
    defaultValues: {
      columns: [
        { type, isNullable, isGenerated, generationExpression, defaultValue },
      ],
      identityColumnIndex,
    },
  });

  return (
    <FormProvider {...form}>
      <DefaultValueInput index={0} />
      <DefaultValueProbe />
    </FormProvider>
  );
}

function DefaultValueProbe() {
  const value = useWatch({ name: 'columns.0.defaultValue' });
  return (
    <div data-testid="default-value-probe">{JSON.stringify(value ?? null)}</div>
  );
}

function getInput() {
  return screen.getByTestId('columns.0.defaultValue');
}

describe('DefaultValueInput', () => {
  describe('placeholder', () => {
    it('shows "NULL" when the column is nullable and has no default', () => {
      render(<Wrapper isNullable defaultValue={null} />);
      expect(getInput()).toHaveAttribute('placeholder', 'NULL');
    });

    it('shows "NO DEFAULT VALUE" when the column is not nullable and has no default', () => {
      render(<Wrapper isNullable={false} defaultValue={null} />);
      expect(getInput()).toHaveAttribute('placeholder', 'NO DEFAULT VALUE');
    });
  });

  describe('loaded value', () => {
    it('renders a quoted literal verbatim', () => {
      render(<Wrapper type="text" defaultValue="'hello'" />);
      expect(getInput()).toHaveValue("'hello'");
    });

    it('renders a function expression verbatim', () => {
      render(<Wrapper type="uuid" defaultValue="gen_random_uuid()" />);
      expect(getInput()).toHaveValue('gen_random_uuid()');
    });
  });

  describe('editing', () => {
    it('writes the typed value verbatim to form state', async () => {
      const user = new TestUserEvent();
      render(<Wrapper type="text" defaultValue={null} />);

      await user.type(getInput(), "'hello'");

      expect(screen.getByTestId('default-value-probe')).toHaveTextContent(
        JSON.stringify("'hello'"),
      );
    });

    it('clears the form value back to null when the input is emptied', async () => {
      const user = new TestUserEvent();
      render(<Wrapper type="text" defaultValue="'hello'" />);

      await user.clear(getInput());

      expect(screen.getByTestId('default-value-probe')).toHaveTextContent(
        'null',
      );
    });
  });

  describe('suggestions', () => {
    it('lists the type-specific functions and fills the input when picked', async () => {
      const user = new TestUserEvent();
      render(<Wrapper type="uuid" defaultValue={null} />);

      await user.click(getInput());
      await user.click(
        screen.getByRole('option', { name: 'gen_random_uuid()' }),
      );

      expect(getInput()).toHaveValue('gen_random_uuid()');
      expect(screen.getByTestId('default-value-probe')).toHaveTextContent(
        JSON.stringify('gen_random_uuid()'),
      );
    });

    it('does not offer an EMPTY STRING suggestion for a text column', async () => {
      const user = new TestUserEvent();
      render(<Wrapper type="text" defaultValue={null} />);

      await user.click(getInput());

      expect(
        screen.queryByRole('option', { name: 'EMPTY STRING' }),
      ).not.toBeInTheDocument();
    });

    it('offers no suggestions for a type without functions', async () => {
      const user = new TestUserEvent();
      render(<Wrapper type="int4" defaultValue={null} />);

      await user.click(getInput());

      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });
  });

  describe('disabled and generated columns', () => {
    it('disables the input for an identity column', () => {
      render(<Wrapper type="uuid" identityColumnIndex={0} />);
      expect(getInput()).toBeDisabled();
    });

    it('renders the generation expression read-only and hides the input', () => {
      render(<Wrapper isGenerated generationExpression="price * quantity" />);

      expect(
        screen.getByTestId('columns.0.generationExpression'),
      ).toHaveTextContent('price * quantity');
      expect(
        screen.queryByTestId('columns.0.defaultValue'),
      ).not.toBeInTheDocument();
    });
  });
});
