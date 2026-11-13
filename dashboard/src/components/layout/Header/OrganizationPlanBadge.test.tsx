import { Organization_Status_Enum } from '@/generated/graphql';
import { render, screen } from '@/tests/testUtils';
import OrganizationPlanBadge from './OrganizationPlanBadge';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('OrganizationPlanBadge', () => {
  it('shows the plan name', () => {
    render(
      <OrganizationPlanBadge plan="Pro" status={Organization_Status_Enum.Ok} />,
    );

    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('shows Cancelled in place of the plan for a cancelled organization', () => {
    render(
      <OrganizationPlanBadge
        plan="Pro"
        status={Organization_Status_Enum.Cancelled}
      />,
    );

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Pro')).not.toBeInTheDocument();
  });
});
