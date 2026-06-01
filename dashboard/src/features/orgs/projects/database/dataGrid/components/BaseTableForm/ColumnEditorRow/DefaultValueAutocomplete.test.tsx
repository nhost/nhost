import { FormProvider, useForm, useWatch } from 'react-hook-form';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import DefaultValueAutocomplete from './DefaultValueAutocomplete';

mockPointerEvent();

interface WrapperProps {
  type?: string | null;
  isNullable?: boolean;
  isGenerated?: boolean;
  generationExpression?: string | null;
  defaultValue?: { value: string; custom: boolean } | null;
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
        {
          type,
          isNullable,
          isGenerated,
          generationExpression,
          defaultValue,
        },
      ],
      identityColumnIndex,
    },
  });

  return (
    <FormProvider {...form}>
      <DefaultValueAutocomplete index={0} />
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

describe('DefaultValueAutocomplete', () => {
  describe('trigger placeholder', () => {
    it('shows "NULL" when the column is nullable and has no default', () => {
      render(<Wrapper isNullable defaultValue={null} />);
      expect(screen.getByTestId('columns.0.defaultValue')).toHaveTextContent(
        'NULL',
      );
    });

    it('shows "NO DEFAULT VALUE" when the column is not nullable and has no default', () => {
      render(<Wrapper isNullable={false} defaultValue={null} />);
      expect(screen.getByTestId('columns.0.defaultValue')).toHaveTextContent(
        'NO DEFAULT VALUE',
      );
    });
  });

  describe('trigger label for a loaded default', () => {
    it('renders "EMPTY STRING" for a ""::text default', () => {
      render(
        <Wrapper
          type="text"
          defaultValue={{ value: "''::text", custom: false }}
        />,
      );
      expect(screen.getByTestId('columns.0.defaultValue')).toHaveTextContent(
        'EMPTY STRING',
      );
    });

    it('renders "EMPTY STRING" for a ""::character varying default', () => {
      render(
        <Wrapper
          type="character varying"
          defaultValue={{ value: "''::character varying", custom: false }}
        />,
      );
      expect(screen.getByTestId('columns.0.defaultValue')).toHaveTextContent(
        'EMPTY STRING',
      );
    });

    it('renders a function expression verbatim', () => {
      render(
        <Wrapper
          type="text"
          defaultValue={{ value: 'version()', custom: false }}
        />,
      );
      expect(screen.getByTestId('columns.0.defaultValue')).toHaveTextContent(
        'version()',
      );
    });

    it('renders a custom literal wrapped in quotes', () => {
      render(
        <Wrapper type="text" defaultValue={{ value: 'hello', custom: true }} />,
      );
      expect(screen.getByTestId('columns.0.defaultValue')).toHaveTextContent(
        "'hello'",
      );
    });
  });

  describe('dropdown contents', () => {
    async function openDropdown() {
      const user = new TestUserEvent();
      await user.click(screen.getByTestId('columns.0.defaultValue'));
    }

    it('lists EMPTY STRING for a text column', async () => {
      render(<Wrapper type="text" />);
      await openDropdown();
      expect(
        screen.getByRole('option', { name: 'EMPTY STRING' }),
      ).toBeInTheDocument();
    });

    it('lists EMPTY STRING for a varchar column', async () => {
      render(<Wrapper type="varchar" />);
      await openDropdown();
      expect(
        screen.getByRole('option', { name: 'EMPTY STRING' }),
      ).toBeInTheDocument();
    });

    it('lists EMPTY STRING for a varchar(10) column', async () => {
      render(<Wrapper type="varchar(10)" />);
      await openDropdown();
      expect(
        screen.getByRole('option', { name: 'EMPTY STRING' }),
      ).toBeInTheDocument();
    });

    it('does not list EMPTY STRING for an int4 column', async () => {
      render(<Wrapper type="int4" />);
      await openDropdown();
      expect(
        screen.queryByRole('option', { name: 'EMPTY STRING' }),
      ).not.toBeInTheDocument();
    });

    it('puts the NULL clear option first when the column is nullable', async () => {
      render(<Wrapper type="text" isNullable />);
      await openDropdown();
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('NULL');
    });

    it('puts the NO DEFAULT VALUE clear option first when the column is not nullable', async () => {
      render(<Wrapper type="text" isNullable={false} />);
      await openDropdown();
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('NO DEFAULT VALUE');
    });
  });

  describe('selection', () => {
    it('writes the cast literal to form state when EMPTY STRING is picked', async () => {
      const user = new TestUserEvent();
      render(<Wrapper type="text" defaultValue={null} />);

      await user.click(screen.getByTestId('columns.0.defaultValue'));
      await user.click(screen.getByRole('option', { name: 'EMPTY STRING' }));

      expect(screen.getByTestId('default-value-probe')).toHaveTextContent(
        JSON.stringify({ value: "''::text", custom: false }),
      );
    });

    it('clears the form value back to null when the clear option is picked', async () => {
      const user = new TestUserEvent();
      render(
        <Wrapper
          type="text"
          isNullable
          defaultValue={{ value: 'version()', custom: false }}
        />,
      );

      await user.click(screen.getByTestId('columns.0.defaultValue'));
      await user.click(screen.getByRole('option', { name: 'NULL' }));

      expect(screen.getByTestId('default-value-probe')).toHaveTextContent(
        'null',
      );
    });
  });

  describe('generated column', () => {
    it('renders the generation expression read-only and hides the autocomplete', () => {
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
