import { vi } from 'vitest';
import DeleteOrg from '@/features/orgs/components/general/components/DeleteOrg/DeleteOrg';
import { mockOrganization } from '@/tests/mocks';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  deleteOrgMutation: vi.fn(),
  execPromiseWithErrorToast: vi.fn(),
  push: vi.fn(),
  refetchOrgs: vi.fn(),
  useCurrentOrg: vi.fn(),
  useDeleteOrganizationMutation: vi.fn(),
  useIsOrgAdmin: vi.fn(),
  useOrgs: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/hooks/useIsOrgAdmin', () => ({
  useIsOrgAdmin: mocks.useIsOrgAdmin,
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: mocks.useOrgs,
}));

vi.mock('@/features/orgs/utils/execPromiseWithErrorToast', () => ({
  execPromiseWithErrorToast: mocks.execPromiseWithErrorToast,
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...actual,
    useDeleteOrganizationMutation: mocks.useDeleteOrganizationMutation,
  };
});

mockPointerEvent();

async function openDeleteDialog(
  organizationName: string | null = 'Example Organization',
) {
  const user = new TestUserEvent();

  mocks.useIsOrgAdmin.mockReturnValue(true);
  mocks.useCurrentOrg.mockReturnValue({
    org:
      organizationName === null
        ? undefined
        : {
            ...mockOrganization,
            id: 'organization-id',
            name: organizationName,
          },
  });

  render(<DeleteOrg />);
  await user.click(screen.getByRole('button', { name: 'Delete' }));

  return {
    dialog: await screen.findByRole('dialog'),
    user,
  };
}

function getConfirmationInput(dialog: HTMLElement) {
  return within(dialog).getByRole('textbox');
}

function getDeleteAction(dialog: HTMLElement) {
  return within(dialog).getByTestId('deleteOrgButton');
}

// The delete action is a submit button. jsdom does not run the form
// submission algorithm inside a Radix portal, so the submit event is
// dispatched directly instead of clicking the button.
function submitDeleteForm(dialog: HTMLElement) {
  fireEvent.submit(
    getConfirmationInput(dialog).closest('form') as HTMLFormElement,
  );
}

async function acknowledgeIrreversibleAction(
  dialog: HTMLElement,
  user: TestUserEvent,
) {
  await user.click(
    within(dialog).getByRole('checkbox', {
      name: 'I understand this action cannot be undone',
    }),
  );
}

async function enableOrganizationDeletion(
  dialog: HTMLElement,
  user: TestUserEvent,
) {
  await TestUserEvent.fireTypeEvent(
    getConfirmationInput(dialog),
    'Example Organization',
  );
  await acknowledgeIrreversibleAction(dialog, user);
}

describe('DeleteOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteOrgMutation.mockResolvedValue({});
    mocks.execPromiseWithErrorToast.mockImplementation(
      async (call: () => Promise<unknown>) => call(),
    );
    mocks.push.mockResolvedValue(true);
    mocks.refetchOrgs.mockResolvedValue({});
    mocks.useDeleteOrganizationMutation.mockReturnValue([
      mocks.deleteOrgMutation,
    ]);
    mocks.useOrgs.mockReturnValue({ refetch: mocks.refetchOrgs });
    mocks.useRouter.mockReturnValue({
      isReady: true,
      push: mocks.push,
      query: {},
    });
  });

  it('requires both the exact organization name and irreversible acknowledgment', async () => {
    const { dialog, user } = await openDeleteDialog();

    expect(getDeleteAction(dialog)).toBeDisabled();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      'Example organization',
    );
    await acknowledgeIrreversibleAction(dialog, user);
    expect(getDeleteAction(dialog)).toBeDisabled();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      'Example Organization',
    );
    expect(getDeleteAction(dialog)).toBeEnabled();

    await acknowledgeIrreversibleAction(dialog, user);
    expect(getDeleteAction(dialog)).toBeDisabled();
  });

  it.each([
    null,
    '',
  ])('fails closed when the organization name is %j', async (organizationName) => {
    const { dialog } = await openDeleteDialog(organizationName);

    expect(
      within(dialog).getByText('Organization confirmation is unavailable.'),
    ).toBeInTheDocument();
    expect(getConfirmationInput(dialog)).toBeDisabled();
    expect(getDeleteAction(dialog)).toBeDisabled();

    submitDeleteForm(dialog);

    expect(mocks.execPromiseWithErrorToast).not.toHaveBeenCalled();
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();
  });

  it('deletes when the form is submitted, and ignores submits while invalid', async () => {
    const { dialog, user } = await openDeleteDialog();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      'wrong value',
    );
    submitDeleteForm(dialog);

    await waitFor(() => {
      expect(getConfirmationInput(dialog)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();

    await enableOrganizationDeletion(dialog, user);
    submitDeleteForm(dialog);

    await waitFor(() => {
      expect(mocks.deleteOrgMutation).toHaveBeenCalledWith(
        expect.objectContaining({ variables: { id: 'organization-id' } }),
      );
    });
  });

  it('clears the confirmation and acknowledgment after the dialog closes', async () => {
    const { dialog, user } = await openDeleteDialog();
    await enableOrganizationDeletion(dialog, user);
    expect(getDeleteAction(dialog)).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const reopenedDialog = await screen.findByRole('dialog');

    expect(getConfirmationInput(reopenedDialog)).toHaveValue('');
    expect(
      within(reopenedDialog).getByRole('checkbox', {
        name: 'I understand this action cannot be undone',
      }),
    ).not.toBeChecked();
    expect(getDeleteAction(reopenedDialog)).toBeDisabled();
  });
});
