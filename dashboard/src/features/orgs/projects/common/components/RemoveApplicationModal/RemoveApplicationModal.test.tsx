import { vi } from 'vitest';
import RemoveApplicationModal from '@/features/orgs/projects/common/components/RemoveApplicationModal/RemoveApplicationModal';
import { mockApplication, mockOrganization } from '@/tests/mocks';
import {
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  deleteApplication: vi.fn(),
  discordAnnounce: vi.fn(),
  push: vi.fn(),
  track: vi.fn(),
  triggerToast: vi.fn(),
  useBillingDeleteAppMutation: vi.fn(),
  useOrgs: vi.fn(),
  useProject: vi.fn(),
  useTrackEvent: vi.fn(),
  useUserData: vi.fn(),
}));

vi.mock('next/router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/router')>();

  return {
    ...actual,
    default: {
      ...actual.default,
      push: mocks.push,
    },
  };
});

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: mocks.useOrgs,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...actual,
    useBillingDeleteAppMutation: mocks.useBillingDeleteAppMutation,
  };
});

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: mocks.useTrackEvent,
}));

vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

vi.mock('@/utils/discordAnnounce', () => ({
  discordAnnounce: mocks.discordAnnounce,
}));

vi.mock('@/utils/toast', () => ({
  triggerToast: mocks.triggerToast,
}));

interface RenderModalOptions {
  isPaidPlan?: boolean;
  organizationName?: string | null;
  projectName?: string | null;
}

function renderModal({
  isPaidPlan = false,
  organizationName = 'Example Org',
  projectName = 'Example Project',
}: RenderModalOptions = {}) {
  mocks.useProject.mockReturnValue({
    project:
      projectName === null
        ? null
        : { ...mockApplication, id: 'project-id', name: projectName },
  });
  mocks.useOrgs.mockReturnValue({
    currentOrg:
      organizationName === null
        ? undefined
        : {
            ...mockOrganization,
            name: organizationName,
            slug: 'example-org',
            plan: {
              ...mockOrganization.plan,
              isFree: !isPaidPlan,
            },
          },
  });

  return render(<RemoveApplicationModal close={mocks.close} />);
}

function getConfirmationInput() {
  return screen.getByRole('textbox');
}

function getDeleteButton() {
  return screen.getByRole('button', { name: 'Delete Project' });
}

async function acknowledgeIrreversibleAction(user: TestUserEvent) {
  await user.click(
    screen.getByRole('checkbox', { name: 'Confirm Delete Project #2' }),
  );
}

describe('RemoveApplicationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteApplication.mockResolvedValue({});
    mocks.push.mockResolvedValue(true);
    mocks.useBillingDeleteAppMutation.mockReturnValue([
      mocks.deleteApplication,
    ]);
    mocks.useTrackEvent.mockReturnValue(mocks.track);
    mocks.useUserData.mockReturnValue({ id: 'user-id' });
  });

  it('requires the exact token and irreversible acknowledgment on a free plan', async () => {
    renderModal();
    const user = new TestUserEvent();

    expect(getDeleteButton()).toBeDisabled();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(),
      'Example Org/Example project',
    );
    await acknowledgeIrreversibleAction(user);
    expect(getDeleteButton()).toBeDisabled();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(),
      'Example Org/Example Project',
    );
    expect(getDeleteButton()).toBeEnabled();

    await acknowledgeIrreversibleAction(user);
    expect(getDeleteButton()).toBeDisabled();
  });

  it('also retains the paid-subscription acknowledgment on a paid plan', async () => {
    renderModal({ isPaidPlan: true });
    const user = new TestUserEvent();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(),
      'Example Org/Example Project',
    );
    await acknowledgeIrreversibleAction(user);
    expect(getDeleteButton()).toBeDisabled();

    const paidAcknowledgment = screen.getByRole('checkbox', {
      name: 'Confirm Delete Project #3',
    });
    await user.click(paidAcknowledgment);
    expect(getDeleteButton()).toBeEnabled();

    await user.click(paidAcknowledgment);
    expect(getDeleteButton()).toBeDisabled();
  });

  it.each([
    { organizationName: null, projectName: 'Example Project' },
    { organizationName: '', projectName: 'Example Project' },
    { organizationName: 'Example Org', projectName: null },
    { organizationName: 'Example Org', projectName: '' },
  ])(
    'fails closed when a required name is missing or empty: %j',
    async ({ organizationName, projectName }) => {
      renderModal({ organizationName, projectName });

      expect(
        screen.getByText('Project confirmation is unavailable.'),
      ).toBeInTheDocument();
      expect(getConfirmationInput()).toBeDisabled();
      expect(getDeleteButton()).toBeDisabled();

      getDeleteButton().removeAttribute('disabled');
      fireEvent.click(getDeleteButton());

      expect(mocks.deleteApplication).not.toHaveBeenCalled();
      expect(mocks.close).not.toHaveBeenCalled();
    },
  );

  it('preserves the default mutation success side effects', async () => {
    renderModal();
    const user = new TestUserEvent();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(),
      'Example Org/Example Project',
    );
    await acknowledgeIrreversibleAction(user);
    await user.click(getDeleteButton());

    await waitFor(() => {
      expect(mocks.deleteApplication).toHaveBeenCalledWith({
        variables: { appID: 'project-id' },
      });
    });
    expect(mocks.track).toHaveBeenCalledWith('Project Deleted');
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/orgs/example-org/projects');
    expect(mocks.triggerToast).toHaveBeenCalledWith('Example Project deleted');
  });
});
