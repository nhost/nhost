import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
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
  it('edit shows only the value and saves once it changed', async () => {
    const user = new TestUserEvent();
    render(
      <TestForm
        mode="edit"
        defaultValues={{ id: 'API_URL', name: 'API_URL', value: 'a' }}
      />,
    );

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.type(screen.getByLabelText('Value'), 'b');

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('create needs a name before it can be submitted', async () => {
    const user = new TestUserEvent();
    render(
      <TestForm
        mode="create"
        defaultValues={{ id: '', name: '', value: '' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    await user.type(screen.getByLabelText('Name'), 'API_URL');

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });
});
