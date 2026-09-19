import { BillingAccessState } from '@/features/orgs/components/billing/BillingAccessState';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

describe('BillingAccessState', () => {
  it('associates its heading and description with the restricted region', () => {
    render(
      <BillingAccessState
        heading="Billing usage is unavailable"
        description="Upgrade to view organization usage."
      />,
    );

    const region = screen.getByRole('region', {
      name: 'Billing usage is unavailable',
    });
    expect(region).toHaveAccessibleDescription(
      'Upgrade to view organization usage.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('runs its optional action', async () => {
    const onAction = vi.fn();
    const user = new TestUserEvent();
    render(
      <BillingAccessState
        heading="Billing usage is unavailable"
        description="Upgrade to view organization usage."
        actionLabel="Upgrade plan"
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Upgrade plan' }));

    expect(onAction).toHaveBeenCalledOnce();
  });
});
