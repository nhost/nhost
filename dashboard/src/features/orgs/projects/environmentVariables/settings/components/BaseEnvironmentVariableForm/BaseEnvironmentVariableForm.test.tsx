import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import BaseEnvironmentVariableForm, {
  type BaseEnvironmentVariableFormValues,
  baseEnvironmentVariableFormValidationSchema,
} from './BaseEnvironmentVariableForm';

function TestForm({
  mode,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  defaultValues: BaseEnvironmentVariableFormValues;
}) {
  const form = useForm<BaseEnvironmentVariableFormValues>({
    defaultValues,
    resolver: yupResolver(baseEnvironmentVariableFormValidationSchema),
  });

  return (
    <FormProvider {...form}>
      <BaseEnvironmentVariableForm
        mode={mode}
        submitButtonText={mode === 'create' ? 'Create' : 'Save'}
        onSubmit={vi.fn()}
      />
    </FormProvider>
  );
}

describe('BaseEnvironmentVariableForm', () => {
  it('edit shows only the value', () => {
    render(
      <TestForm
        mode="edit"
        defaultValues={{ id: 'API_URL', name: 'API_URL', value: 'a' }}
      />,
    );

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('create shows an error when submitted without a name', async () => {
    const user = new TestUserEvent();
    render(
      <TestForm
        mode="create"
        defaultValues={{ id: '', name: '', value: '' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('Name is a required field'),
    ).toBeInTheDocument();
  });
});
