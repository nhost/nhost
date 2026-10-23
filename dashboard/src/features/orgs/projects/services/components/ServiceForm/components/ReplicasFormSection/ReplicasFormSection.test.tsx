import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import {
  type ServiceFormValues,
  validationSchema,
} from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import ReplicasFormSection from './ReplicasFormSection';

function TestWrapper() {
  const form = useForm<ServiceFormValues>({
    defaultValues: { name: '', replicas: 1, autoscaler: null },
    resolver: yupResolver(validationSchema),
  });
  // Mirrors ServiceForm, which reads replicas through watch() for the cost.
  const { replicas } = form.watch();

  return (
    <FormProvider {...form}>
      <button type="button" onClick={() => form.trigger('replicas')}>
        validate
      </button>
      <input aria-label="Name" {...form.register('name')} />
      <ReplicasFormSection />
      <output>{`${typeof replicas}:${replicas}`}</output>
    </FormProvider>
  );
}

describe('ReplicasFormSection', () => {
  it('shows a validation error when the replicas input is cleared', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.clear(screen.getByLabelText('Replicas'));
    await user.click(screen.getByRole('button', { name: 'validate' }));

    expect(
      await screen.findByText('Replicas must be a number.'),
    ).toBeInTheDocument();
  });

  it('keeps replicas a number after blurring and editing another field', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    const input = screen.getByLabelText('Replicas');
    await user.clear(input);
    await user.type(input, '2');
    await user.type(screen.getByLabelText('Name'), 'a');

    expect(screen.getByRole('status')).toHaveTextContent('number:2');
  });
});
