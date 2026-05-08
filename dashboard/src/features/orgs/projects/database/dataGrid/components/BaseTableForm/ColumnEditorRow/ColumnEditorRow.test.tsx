import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from '@/tests/testUtils';
import ColumnEditorRow from './ColumnEditorRow';

interface FormData {
  columns: Array<{
    name: string;
    type: { value: string; label: string } | null;
    defaultValue: null;
    isNullable: boolean;
    isUnique: boolean;
    isGenerated: boolean;
    generationExpression: string | null;
  }>;
  foreignKeyRelations: [];
  primaryKeyIndices: string[];
  identityColumnIndex: number | null;
}

function TestWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues: FormData;
}) {
  const methods = useForm<FormData>({ defaultValues });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

const baseColumn = {
  name: 'price',
  type: { value: 'numeric', label: 'numeric' },
  defaultValue: null,
  isNullable: true,
  isUnique: false,
  isGenerated: false,
  generationExpression: null,
};

const generatedColumn = {
  name: 'total',
  type: { value: 'numeric', label: 'numeric' },
  defaultValue: null,
  isNullable: false,
  isUnique: false,
  isGenerated: true,
  generationExpression: 'price * quantity',
};

const baseFormValues: FormData = {
  columns: [baseColumn],
  foreignKeyRelations: [],
  primaryKeyIndices: [],
  identityColumnIndex: null,
};

describe('ColumnEditorRow', () => {
  describe('regular column', () => {
    it('should not show the Generated badge', () => {
      render(
        <TestWrapper defaultValues={baseFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(
        screen.queryByLabelText('Generated column'),
      ).not.toBeInTheDocument();
    });

    it('should have the type field enabled', () => {
      render(
        <TestWrapper defaultValues={baseFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('columns.0.type')).not.toBeDisabled();
    });

    it('should have the nullable checkbox enabled', () => {
      render(
        <TestWrapper defaultValues={baseFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('columns.0.isNullable')).not.toBeDisabled();
    });
  });

  describe('generated column', () => {
    const generatedFormValues: FormData = {
      columns: [generatedColumn],
      foreignKeyRelations: [],
      primaryKeyIndices: [],
      identityColumnIndex: null,
    };

    it('should show the Generated badge', () => {
      render(
        <TestWrapper defaultValues={generatedFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(screen.getByLabelText('Generated column')).toBeInTheDocument();
    });

    it('should show the generation expression in place of the default value field', () => {
      render(
        <TestWrapper defaultValues={generatedFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('columns.0.generationExpression')).toHaveValue(
        'price * quantity',
      );
    });

    it('should have the type field disabled', () => {
      render(
        <TestWrapper defaultValues={generatedFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('columns.0.type')).toBeDisabled();
    });

    it('should have the nullable checkbox disabled', () => {
      render(
        <TestWrapper defaultValues={generatedFormValues}>
          <ColumnEditorRow index={0} remove={() => {}} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('columns.0.isNullable')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });
});
