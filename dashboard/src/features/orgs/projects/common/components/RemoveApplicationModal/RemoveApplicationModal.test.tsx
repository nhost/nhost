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
  handler?: () => unknown;
  isPaidPlan?: boolean;
  organizationName?: string | null;
  projectName?: string | null;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

function renderModal({
  handler,
  isPaidPlan = false,
  organizationName = 'Example Org',
  projectName = 'Example Project',
  title,
  description,
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

  return render(
    <RemoveApplicationModal
      close={mocks.close}
      handler={handler}
      title={title}
      description={description}
    />,
  );
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

async function enableProjectDeletion({
  isPaidPlan = false,
  token = 'Example Org/Example Project',
}: {
  isPaidPlan?: boolean;
  token?: string;
} = {}) {
  const user = new TestUserEvent();
  await TestUserEvent.fireTypeEvent(getConfirmationInput(), token);
  await acknowledgeIrreversibleAction(user);

  if (isPaidPlan) {
    await user.click(
      screen.getByRole('checkbox', { name: 'Confirm Delete Project #3' }),
    );
  }

  return user;
}

describe('RemoveApplicationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteApplication.mockResolvedValue({});
    mocks.discordAnnounce.mockResolvedValue(undefined);
    mocks.push.mockResolvedValue(true);
    mocks.useBillingDeleteAppMutation.mockReturnValue([
      mocks.deleteApplication,
    ]);
    mocks.useTrackEvent.mockReturnValue(mocks.track);
    mocks.useUserData.mockReturnValue({ id: 'user-id' });
  });

  it('replaces only the first checkbox and starts with deletion disabled', () => {
    renderModal();

    expect(getConfirmationInput()).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Confirm Delete Project #1' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Confirm Delete Project #2' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Confirm Delete Project #3' }),
    ).not.toBeInTheDocument();
    expect(getDeleteButton()).toBeDisabled();
  });

  it.each([
    'example org/Example Project',
    'Example Org/example project',
    'Example Org /Example Project',
    'Example Org/ Example Project',
    ' Example Org/Example Project',
    'Example Org/Example Project ',
    'Example Org/Example',
    'Example Project',
    'Example Org',
  ])('rejects the near-match confirmation value %j', async (value) => {
    renderModal();
    const user = new TestUserEvent();

    await TestUserEvent.fireTypeEvent(getConfirmationInput(), value);
    await acknowledgeIrreversibleAction(user);

    expect(getDeleteButton()).toBeDisabled();
  });

  it('compares a whitespace-bearing token without trimming or normalizing it', async () => {
    const token = '  Example Org  / Example Project ';
    const user = new TestUserEvent();
    renderModal({
      organizationName: '  Example Org  ',
      projectName: ' Example Project ',
    });

    await acknowledgeIrreversibleAction(user);
    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(),
      'Example Org/Example Project',
    );
    expect(getDeleteButton()).toBeDisabled();

    await TestUserEvent.fireTypeEvent(getConfirmationInput(), token);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'CODE' && element.textContent === token,
      ),
    ).toBeInTheDocument();
    expect(getDeleteButton()).toBeEnabled();
  });

  it.each([
    { organizationName: null, projectName: 'Example Project' },
    { organizationName: '', projectName: 'Example Project' },
    { organizationName: 'Example Org', projectName: null },
    { organizationName: 'Example Org', projectName: '' },
  ])('fails closed when a required name is missing or empty: %j', async ({
    organizationName,
    projectName,
  }) => {
    renderModal({ organizationName, projectName });

    expect(
      screen.getByText('Project confirmation is unavailable.'),
    ).toBeInTheDocument();
    expect(getConfirmationInput()).toBeDisabled();
    expect(document.body).not.toHaveTextContent('undefined');
    expect(document.body).not.toHaveTextContent('null');
    expect(getDeleteButton()).toBeDisabled();

    getDeleteButton().removeAttribute('disabled');
    fireEvent.click(getDeleteButton());

    expect(mocks.deleteApplication).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('requires the exact token and irreversible acknowledgment on a free plan', async () => {
    renderModal();
    const user = new TestUserEvent();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(),
      'Example Org/Example Project',
    );
    expect(getDeleteButton()).toBeDisabled();

    await acknowledgeIrreversibleAction(user);
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

  it('supports native paste into the confirmation input', async () => {
    renderModal();
    const user = new TestUserEvent();
    const input = getConfirmationInput();

    await user.click(input);
    await user.paste('Example Org/Example Project');

    expect(input).toHaveValue('Example Org/Example Project');
  });

  it('labels the input without a placeholder and prevents token selection', () => {
    renderModal();

    const input = screen.getByLabelText(
      'Type Example Org/Example Project to confirm',
    );
    const token = screen.getByText('Example Org/Example Project');

    expect(input).not.toHaveAttribute('placeholder');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(token).toHaveClass(
      'select-none',
      'whitespace-pre-wrap',
      'break-words',
    );
    expect(token.parentElement).not.toHaveClass('select-none');
    expect(input).not.toHaveClass('select-none');
  });

  it('flags a non-matching value and clears the error once it matches', async () => {
    renderModal();
    const input = getConfirmationInput();

    await TestUserEvent.fireTypeEvent(input, 'Example Org/Example');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass(
      'aria-[invalid=true]:border-red-500',
      'aria-[invalid=true]:focus:border-red-500',
      'aria-[invalid=true]:focus:ring-red-500',
    );

    await TestUserEvent.fireTypeEvent(input, 'Example Org/Example Project');

    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('stays neutral until the confirmation input is touched', async () => {
    renderModal();
    const input = getConfirmationInput();

    expect(input).toHaveAttribute('aria-invalid', 'false');

    await TestUserEvent.fireTypeEvent(input, 'Example Org/Example Project');
    await TestUserEvent.fireTypeEvent(input, '');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(getDeleteButton()).toBeDisabled();
  });

  it('distinguishes the empty and mismatched confirmation messages', async () => {
    renderModal();
    const input = getConfirmationInput();

    await TestUserEvent.fireTypeEvent(input, 'wrong value');

    expect(screen.getByText('Value does not match')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Typing the organization and project name is required',
      ),
    ).not.toBeInTheDocument();

    await TestUserEvent.fireTypeEvent(input, '');

    expect(
      screen.getByText('Typing the organization and project name is required'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Value does not match')).not.toBeInTheDocument();

    await TestUserEvent.fireTypeEvent(input, 'Example Org/Example Project');

    expect(
      screen.queryByText(
        'Typing the organization and project name is required',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Value does not match')).not.toBeInTheDocument();
  });

  // Enter submits natively in the browser. jsdom does not run the form
  // submission algorithm inside a Radix portal, so the submit event is
  // dispatched directly instead of typing '{Enter}'.
  it('deletes when the form is submitted, and ignores submits while invalid', async () => {
    renderModal();
    const form = getConfirmationInput().closest('form') as HTMLFormElement;

    await TestUserEvent.fireTypeEvent(getConfirmationInput(), 'wrong value');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(getConfirmationInput()).toHaveAttribute('aria-invalid', 'true');
    });
    expect(mocks.deleteApplication).not.toHaveBeenCalled();

    await enableProjectDeletion();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.deleteApplication).toHaveBeenCalledTimes(1);
    });
  });

  it('never renders validation text for the acknowledgments', async () => {
    renderModal({ isPaidPlan: true });
    const user = new TestUserEvent();

    await acknowledgeIrreversibleAction(user);
    await acknowledgeIrreversibleAction(user);

    expect(document.body).not.toHaveTextContent(/invalid/i);
    expect(document.body).not.toHaveTextContent(/required/i);
  });

  it('renders the confirmation input after the acknowledgment checkboxes', () => {
    renderModal({ isPaidPlan: true });

    const acknowledgments = screen.getAllByRole('checkbox');
    const input = getConfirmationInput();

    expect(acknowledgments).toHaveLength(2);
    acknowledgments.forEach((acknowledgment) => {
      expect(
        acknowledgment.compareDocumentPosition(input) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('renders ReactNode title and description props', () => {
    renderModal({
      title: <span>Custom project title</span>,
      description: <strong>Custom project description</strong>,
    });

    expect(screen.getByText('Custom project title').tagName).toBe('SPAN');
    expect(screen.getByText('Custom project description').tagName).toBe(
      'STRONG',
    );
  });

  it('runs the custom handler, closes, and prevents repeated deletion while pending', async () => {
    let resolveHandler: VoidFunction = () => {};
    const handler = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHandler = resolve;
        }),
    );
    renderModal({ handler });
    const user = await enableProjectDeletion();

    await user.click(getDeleteButton());

    await waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(getDeleteButton()).toBeDisabled();
    });
    expect(mocks.deleteApplication).not.toHaveBeenCalled();

    resolveHandler();

    await waitFor(() => {
      expect(mocks.close).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves the default mutation success side effects', async () => {
    renderModal();
    const user = await enableProjectDeletion();

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

  it('preserves default mutation error announcement and toast behavior', async () => {
    mocks.deleteApplication.mockRejectedValue(new Error('delete failed'));
    renderModal();
    const user = await enableProjectDeletion();

    await user.click(getDeleteButton());

    await waitFor(() => {
      expect(mocks.discordAnnounce).toHaveBeenCalledWith(
        'Error trying to delete project: Example Project',
      );
    });
    expect(mocks.triggerToast).toHaveBeenCalledWith(
      'An error occurred while trying to delete Example Project',
    );
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(getDeleteButton()).toBeEnabled();
  });

  it('defensively rejects an invalid click before loading or either deletion path', () => {
    const handler = vi.fn();
    renderModal({ handler });
    const button = getDeleteButton();

    button.removeAttribute('disabled');
    fireEvent.click(button);

    expect(handler).not.toHaveBeenCalled();
    expect(mocks.deleteApplication).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(button.querySelector('.animate-spin')).not.toBeInTheDocument();
  });
});
