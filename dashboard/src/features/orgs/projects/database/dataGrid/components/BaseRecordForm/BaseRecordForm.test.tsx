import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import BaseRecordForm, { type BaseRecordFormProps } from './BaseRecordForm';

const mocks = vi.hoisted(() => ({
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
}));

const mockColumns: DataBrowserColumnMetadata[] = [
  {
    id: 'col1',
    isPrimary: true,
    isNullable: false,
    isIdentity: false,
    defaultValue: undefined,
    specificType: 'text',
    baseType: 'text',
    isArray: false,
    displayType: 'text',
  },
];

function TestRecordFormWrapper({
  columns = mockColumns,
  defaultValues = {},
  ...props
}: Partial<BaseRecordFormProps> & { defaultValues?: Record<string, unknown> }) {
  const methods = useForm({ defaultValues });
  return (
    <FormProvider {...methods}>
      <BaseRecordForm
        columns={columns}
        onSubmit={mocks.onSubmit}
        onCancel={mocks.onCancel}
        {...props}
      />
    </FormProvider>
  );
}

const mockColumnsWithGenerated: DataBrowserColumnMetadata[] = [
  {
    id: 'price',
    isPrimary: false,
    isNullable: false,
    isIdentity: false,
    isGenerated: false,
    defaultValue: undefined,
    specificType: 'numeric',
    baseType: 'numeric',
    isArray: false,
    displayType: 'numeric',
  },
  {
    id: 'total',
    isPrimary: false,
    isNullable: false,
    isIdentity: false,
    isGenerated: true,
    generationExpression: 'price * quantity',
    defaultValue: undefined,
    specificType: 'numeric',
    baseType: 'numeric',
    isArray: false,
    displayType: 'numeric',
  },
];

describe('BaseRecordForm', () => {
  it('should not call onSubmit when cancel is clicked', async () => {
    render(<TestRecordFormWrapper />);

    const user = new TestUserEvent();
    const cancelButton = screen.getByText(/cancel/i);

    await user.click(cancelButton);

    expect(mocks.onCancel).toHaveBeenCalled();
    expect(mocks.onSubmit).not.toHaveBeenCalled();
  });

  it('should exclude generated columns from the form', () => {
    render(<TestRecordFormWrapper columns={mockColumnsWithGenerated} />);

    expect(
      screen.queryByRole('textbox', { name: /total/i }),
    ).not.toBeInTheDocument();
  });

  it('should not include generated columns in the submit payload', async () => {
    render(<TestRecordFormWrapper columns={mockColumnsWithGenerated} />);

    const user = new TestUserEvent();
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mocks.onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ total: expect.anything() }),
    );
  });

  it('should show the omitted note when there are generated columns', () => {
    render(<TestRecordFormWrapper columns={mockColumnsWithGenerated} />);

    expect(screen.getByText(/1 generated column omitted/i)).toBeInTheDocument();
  });
});

describe('BaseRecordForm handleSubmit', () => {
  beforeEach(() => {
    mocks.onSubmit.mockResolvedValue(undefined);
  });

  const nullableColumnWithDefault: DataBrowserColumnMetadata = {
    id: 'col',
    specificType: 'text',
    baseType: 'text',
    isArray: false,
    displayType: 'text',
    isNullable: true,
    defaultValue: 'some_default',
  };

  const requiredColumnWithDefault: DataBrowserColumnMetadata = {
    id: 'col',
    specificType: 'text',
    baseType: 'text',
    isArray: false,
    displayType: 'text',
    isNullable: false,
    defaultValue: 'some_default',
  };

  const nullableColumnWithoutDefault: DataBrowserColumnMetadata = {
    id: 'col',
    specificType: 'text',
    baseType: 'text',
    isArray: false,
    displayType: 'text',
    isNullable: true,
    defaultValue: undefined,
  };

  it('nullable column with default uses DEFAULT when field is cleared', async () => {
    render(
      <TestRecordFormWrapper
        columns={[nullableColumnWithDefault]}
        defaultValues={{ col: POSTGRES_DEFAULT_PLACEHOLDER }}
      />,
    );

    await new TestUserEvent().click(
      screen.getByRole('button', { name: /save/i }),
    );

    expect(mocks.onSubmit).toHaveBeenCalledWith({
      col: { fallbackValue: 'DEFAULT' },
    });
  });

  it('nullable column with default uses NULL when NULL toggle is active', async () => {
    render(
      <TestRecordFormWrapper
        columns={[nullableColumnWithDefault]}
        defaultValues={{ col: null }}
      />,
    );

    await new TestUserEvent().click(
      screen.getByRole('button', { name: /save/i }),
    );

    expect(mocks.onSubmit).toHaveBeenCalledWith({
      col: { value: null, fallbackValue: 'NULL' },
    });
  });

  it('required column with default uses DEFAULT when field is empty', async () => {
    render(
      <TestRecordFormWrapper
        columns={[requiredColumnWithDefault]}
        defaultValues={{ col: null }}
      />,
    );

    await new TestUserEvent().click(
      screen.getByRole('button', { name: /save/i }),
    );

    expect(mocks.onSubmit).toHaveBeenCalledWith({
      col: { value: null, fallbackValue: 'DEFAULT' },
    });
  });

  it('nullable column without default uses NULL when field is empty', async () => {
    render(
      <TestRecordFormWrapper
        columns={[nullableColumnWithoutDefault]}
        defaultValues={{ col: null }}
      />,
    );

    await new TestUserEvent().click(
      screen.getByRole('button', { name: /save/i }),
    );

    expect(mocks.onSubmit).toHaveBeenCalledWith({
      col: { value: null, fallbackValue: 'NULL' },
    });
  });

  it('nullable column with default submits a literal empty string verbatim', async () => {
    render(
      <TestRecordFormWrapper
        columns={[nullableColumnWithDefault]}
        defaultValues={{ col: '' }}
      />,
    );

    await new TestUserEvent().click(
      screen.getByRole('button', { name: /save/i }),
    );

    expect(mocks.onSubmit).toHaveBeenCalledWith({
      col: { value: '', isArray: false },
    });
  });
});
