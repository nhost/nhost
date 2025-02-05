import {
  mockMatchMediaValue,
  mockOrganization,
  mockOrganizations,
  mockOrganizationsWithNewOrg,
  newOrg,
} from '@/tests/mocks';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import { prefetchNewAppQuery } from '@/tests/msw/mocks/graphql/prefetchNewAppQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  fireEvent,
  mockPointerEvent,
  queryClient,
  render,
  screen,
  waitFor,
} from '@/tests/orgs/testUtils';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { useState } from 'react';
import { afterAll, beforeAll, vi } from 'vitest';
import TransferProjectDialog from './TransferProjectDialog';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

mockPointerEvent();

const getUseRouterObject = (session_id?: string) => ({
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  asPath: '/orgs/xyz/projects/test-project',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
    session_id,
  },
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
});
const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useOrgs: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', async () => {
  const actualUseOrgs = await vi.importActual<any>(
    '@/features/orgs/projects/hooks/useOrgs',
  );
  return {
    ...actualUseOrgs,
    useOrgs: mocks.useOrgs,
  };
});

const postOrganizationRequestResolver = createGraphqlMockResolver(
  'postOrganizationRequest',
  'mutation',
);

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

export function DialogWrapper({
  defaultOpen = true,
}: {
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <TransferProjectDialog open={open} setOpen={setOpen} />;
}

const server = setupServer(tokenQuery);

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});

afterEach(() => {
  queryClient.clear();
  mocks.useRouter.mockRestore();
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

test('opens create org dialog when selecting "create new org" and closes transfer dialog', async () => {
  mocks.useRouter.mockImplementation(() => getUseRouterObject());
  const user = userEvent.setup();

  server.use(getProjectQuery);
  server.use(getOrganization);
  mocks.useOrgs.mockImplementation(() => ({
    orgs: mockOrganizations,
    currentOrg: mockOrganization,
    loading: false,
    refetch: vi.fn(),
  }));
  server.use(prefetchNewAppQuery);

  render(<DialogWrapper />);
  const organizationCombobox = await screen.findByRole('combobox', {
    name: /Organization/i,
  });

  expect(organizationCombobox).toBeInTheDocument();

  await user.click(organizationCombobox);

  const newOrgOption = await screen.findByRole('option', {
    name: 'New Organization',
  });
  await user.click(newOrgOption);
  expect(organizationCombobox).toHaveTextContent('New Organization');

  const submitButton = await screen.findByText('Continue');
  expect(submitButton).toHaveTextContent('Continue');

  fireEvent(
    submitButton,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );

  await waitFor(() => {
    expect(submitButton).not.toBeInTheDocument();
  });

  const newOrgTitle = await screen.findByText('New Organization');
  expect(newOrgTitle).toBeInTheDocument();
  const closeButton = await screen.findByText('Close');
  fireEvent(
    closeButton,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );
  await waitFor(() => {
    expect(newOrgTitle).not.toBeInTheDocument();
  });

  const submitButtonAfterClosingNewOrgDialog =
    await screen.findByText('Continue');
  await waitFor(() => {
    expect(submitButtonAfterClosingNewOrgDialog).toHaveTextContent('Continue');
  });
});

test(`transfer dialog opens automatically when there is a session_id and selects the ${newOrg.name} from the dropdown`, async () => {
  mocks.useRouter.mockImplementation(() => getUseRouterObject('session_id'));
  server.use(getProjectQuery);
  server.use(getOrganization);
  mocks.useOrgs.mockImplementation(() => ({
    orgs: mockOrganizations,
    currentOrg: mockOrganization,
    loading: false,
    refetch: vi.fn(),
  }));
  server.use(prefetchNewAppQuery);
  server.use(postOrganizationRequestResolver.handler);

  render(<DialogWrapper defaultOpen={false} />);
  const processingNewOrgText = await screen.findByText(
    'Processing new organization request',
  );

  expect(processingNewOrgText).toBeInTheDocument();

  const closeButton = await screen.findByText('Close');

  fireEvent(
    closeButton,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );

  await waitFor(() => {});
  expect(closeButton).toBeInTheDocument();

  postOrganizationRequestResolver.resolve({
    billingPostOrganizationRequest: {
      Status: 'COMPLETED',
      Slug: newOrg.slug,
      ClientSecret: null,
      __typename: 'PostOrganizationRequestResponse',
    },
  });

  mocks.useOrgs.mockImplementation(() => ({
    orgs: mockOrganizationsWithNewOrg,
    currentOrg: mockOrganization,
    loading: false,
    refetch: vi.fn(),
  }));

  const organizationCombobox = await screen.findByRole('combobox', {
    name: /Organization/i,
  });

  expect(organizationCombobox).toHaveTextContent(newOrg.name);

  const submitButton = await screen.findByText('Transfer');
  expect(submitButton).not.toBeDisabled();
});
