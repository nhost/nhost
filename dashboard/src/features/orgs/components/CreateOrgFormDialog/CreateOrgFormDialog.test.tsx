import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useState } from 'react';
import CreateOrgFormDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useOrganizationNewRequestsQuery } from '@/generated/graphql';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { prefetchNewAppQuery } from '@/tests/msw/mocks/graphql/prefetchNewAppQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  // An existing Starter organization makes Pro, a paid plan, the default.
  useOrgs: () => ({
    orgs: [{ slug: 'org-a', plan: { name: 'Starter', isFree: true } }],
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/orgs/components/StripeEmbeddedForm', () => ({
  StripeEmbeddedForm: () => <div>Stripe checkout</div>,
}));

const organizationNewRequestsFetched = vi.fn();

const server = setupServer(
  tokenQuery,
  prefetchNewAppQuery,
  nhostGraphQLLink.query('organizationNewRequests', () => {
    organizationNewRequestsFetched();
    return HttpResponse.json({ data: { organizationNewRequests: [] } });
  }),
  nhostGraphQLLink.mutation('createOrganizationRequest', () =>
    HttpResponse.json({
      data: { billingCreateOrganizationRequest: 'secret-1' },
    }),
  ),
);

mockScrollIntoViewAndPointerCapture();

// Stands in for the inbox, which looks up unfinished checkouts.
function PendingRequestsQuery() {
  useOrganizationNewRequestsQuery({ variables: { userID: 'user-1' } });
  return null;
}

// Stands in for `Header`, which controls the dialog and hides its own button.
function DialogHost() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <CreateOrgFormDialog
        hideNewOrgButton
        isOpen={open}
        onOpenStateChange={setOpen}
      />
      <PendingRequestsQuery />
    </>
  );
}

async function reachCheckout(user: TestUserEvent) {
  await user.click(screen.getByRole('button', { name: 'Open dialog' }));
  await user.type(
    await screen.findByLabelText('Organization Name'),
    'Acme Inc',
  );
  await user.click(screen.getByRole('combobox'));
  await user.click((await screen.findAllByRole('option'))[0]);
  await user.click(screen.getByRole('button', { name: 'Create organization' }));

  expect(await screen.findByText('Stripe checkout')).toBeInTheDocument();
}

describe('CreateOrgFormDialog', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    organizationNewRequestsFetched.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    server.close();
  });

  it('starts over with the form after an abandoned checkout is closed', async () => {
    const user = new TestUserEvent();
    render(<DialogHost />);

    await reachCheckout(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByText('Stripe checkout')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    expect(
      await screen.findByLabelText('Organization Name'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Stripe checkout')).not.toBeInTheDocument();
  });

  it('refreshes the unfinished checkouts the inbox offers to continue', async () => {
    const user = new TestUserEvent();
    render(<DialogHost />);
    await waitFor(() => {
      expect(organizationNewRequestsFetched).toHaveBeenCalledOnce();
    });

    await reachCheckout(user);

    await waitFor(() => {
      expect(organizationNewRequestsFetched).toHaveBeenCalledTimes(2);
    });
  });
});
