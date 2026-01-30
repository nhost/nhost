import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import BaseRecordForm, { type BaseRecordFormProps } from './BaseRecordForm';

const mocks = vi.hoisted(() => ({
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
}));

const mockColumns: DataBrowserGridColumn[] = [
  {
    id: 'col1',
    isPrimary: true,
    isNullable: false,
    isIdentity: false,
    defaultValue: null,
    type: 'text',
  },
] as DataBrowserGridColumn[];

function TestRecordFormWrapper(props: Partial<BaseRecordFormProps>) {
  const methods = useForm();
  return (
    <FormProvider {...methods}>
      <BaseRecordForm
        columns={mockColumns}
        onSubmit={mocks.onSubmit}
        onCancel={mocks.onCancel}
        {...props}
      />
    </FormProvider>
  );
}

describe('BaseRecordForm', () => {
  it('should not call onSubmit when cancel is clicked', async () => {
    render(<TestRecordFormWrapper />);

    const user = new TestUserEvent();
    const cancelButton = screen.getByText(/cancel/i);

    await user.click(cancelButton);

    expect(mocks.onCancel).toHaveBeenCalled();
    expect(mocks.onSubmit).not.toHaveBeenCalled();
  });
});
