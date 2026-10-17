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
    defaultValues: { replicas: 1, autoscaler: null },
    resolver: yupResolver(validationSchema),
  });

  return (
    <FormProvider {...form}>
      <button type="button" onClick={() => form.trigger('replicas')}>
        validate
      </button>
      <ReplicasFormSection />
    </FormProvider>
  );
}

describe('ReplicasFormSection', () => {
  it('shows the replica count in the heading', () => {
    render(<TestWrapper />);

    expect(
      screen.getByRole('heading', { name: 'Replicas (1)' }),
    ).toBeInTheDocument();
  });

  it('does not show NaN when the replicas input is cleared', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.clear(screen.getByLabelText('Replicas'));

    expect(
      screen.getByRole('heading', { name: 'Replicas' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'validate' }));

    expect(
      await screen.findByText('Replicas must be a number.'),
    ).toBeInTheDocument();
  });

  it('updates the heading when a new value is typed', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    const input = screen.getByLabelText('Replicas');
    await user.clear(input);
    await user.type(input, '0');

    expect(
      screen.getByRole('heading', { name: 'Replicas (0)' }),
    ).toBeInTheDocument();
  });
});
