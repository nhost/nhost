import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
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
    type: 'text',
    specificType: 'text',
    dataType: 'text',
  },
];

function TestRecordFormWrapper(props: Partial<BaseRecordFormProps>) {
  const columns = props.columns ?? mockColumns;
  const methods = useForm({
    defaultValues: columns.reduce<Record<string, null>>(
      (acc, col) => ({ ...acc, [col.id]: null }),
      {},
    ),
  });
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
    type: 'number',
    specificType: 'numeric',
    dataType: 'numeric',
  },
  {
    id: 'total',
    isPrimary: false,
    isNullable: false,
    isIdentity: false,
    isGenerated: true,
    generationExpression: 'price * quantity',
    defaultValue: undefined,
    type: 'number',
    specificType: 'numeric',
    dataType: 'numeric',
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
