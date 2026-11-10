import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import type { DialogFormProps } from '@/types/common';
import BaseEnvironmentVariableForm, {
  type BaseEnvironmentVariableFormValues,
  baseEnvironmentVariableFormValidationSchema,
} from './BaseEnvironmentVariableForm';

function TestForm({
  mode,
  defaultValues,
  location,
}: DialogFormProps & {
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
        location={location}
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

  it('opens Secrets in a new tab', () => {
    render(
      <TestForm
        mode="create"
        defaultValues={{ id: '', name: '', value: '' }}
      />,
    );

    const link = screen.getByRole('link', { name: 'Secrets' });
    expect(link).toHaveAttribute(
      'href',
      '/orgs/xyz/projects/test-project/settings?tab=secrets',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });
});
