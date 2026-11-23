import { vi } from 'vitest';
import { Organization_Status_Enum } from '@/generated/graphql';
import { mockOrganization, mockRouter } from '@/tests/mocks';
import { render } from '@/tests/testUtils';
import OrgStatusRedirect from './OrgStatusRedirect';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useCurrentOrg: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));
vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

const push = vi.fn();

function setup(status: Organization_Status_Enum, pathname: string) {
  mocks.useCurrentOrg.mockReturnValue({
    org: { ...mockOrganization, status },
  });
  mocks.useRouter.mockReturnValue({ ...mockRouter, pathname, push });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('OrgStatusRedirect', () => {
  it('sends a locked organization to billing', () => {
    setup(Organization_Status_Enum.Locked, '/orgs/[orgSlug]/projects');

    render(<OrgStatusRedirect />);

    expect(push).toHaveBeenCalledWith(`/orgs/${mockOrganization.slug}/billing`);
  });

  it('does nothing on the billing page', () => {
    setup(Organization_Status_Enum.Disabled, '/orgs/[orgSlug]/billing');

    render(<OrgStatusRedirect />);

    expect(push).not.toHaveBeenCalled();
  });

  it('does nothing for an active organization', () => {
    setup(Organization_Status_Enum.Ok, '/orgs/[orgSlug]/projects');

    render(<OrgStatusRedirect />);

    expect(push).not.toHaveBeenCalled();
  });

  it('redirects again when the user navigates away from billing', () => {
    setup(Organization_Status_Enum.Locked, '/orgs/[orgSlug]/billing');
    const { rerender } = render(<OrgStatusRedirect />);
    expect(push).not.toHaveBeenCalled();

    setup(Organization_Status_Enum.Locked, '/orgs/[orgSlug]/settings');
    rerender(<OrgStatusRedirect />);

    expect(push).toHaveBeenCalledWith(`/orgs/${mockOrganization.slug}/billing`);
  });
});
