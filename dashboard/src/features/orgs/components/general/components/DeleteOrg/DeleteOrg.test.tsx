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

interface RenderDeleteOrgOptions {
  isAdmin?: boolean;
  organizationName?: string | null;
}

function renderDeleteOrg({
  isAdmin = true,
  organizationName = 'Example Organization',
}: RenderDeleteOrgOptions = {}) {
  mocks.useIsOrgAdmin.mockReturnValue(isAdmin);
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

  return render(<DeleteOrg />);
}

async function openDeleteDialog(options?: RenderDeleteOrgOptions) {
  const user = new TestUserEvent();
  const renderResult = renderDeleteOrg(options);
  await user.click(screen.getByRole('button', { name: 'Delete' }));

  return {
    ...renderResult,
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
  organizationName = 'Example Organization',
) {
  await TestUserEvent.fireTypeEvent(
    getConfirmationInput(dialog),
    organizationName,
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

  it('replaces only the first checkbox and starts with deletion disabled', async () => {
    const { dialog } = await openDeleteDialog();
    const dialogQueries = within(dialog);

    expect(getConfirmationInput(dialog)).toBeInTheDocument();
    expect(document.getElementById('delete-check1')).not.toBeInTheDocument();
    expect(dialogQueries.getAllByRole('checkbox')).toHaveLength(1);
    expect(
      dialogQueries.getByRole('checkbox', {
        name: 'I understand this action cannot be undone',
      }),
    ).toBeInTheDocument();
    expect(getDeleteAction(dialog)).toBeDisabled();
  });

  it.each([
    'example Organization',
    'Example organization',
    ' Example Organization',
    'Example Organization ',
    'Example  Organization',
    'Example',
    'Organization',
  ])('rejects the near-match organization name %j', async (value) => {
    const { dialog, user } = await openDeleteDialog();

    await TestUserEvent.fireTypeEvent(getConfirmationInput(dialog), value);
    await acknowledgeIrreversibleAction(dialog, user);

    expect(getDeleteAction(dialog)).toBeDisabled();
  });

  it('compares a whitespace-bearing organization name without normalization', async () => {
    const organizationName = '  Example Organization  ';
    const { dialog, user } = await openDeleteDialog({ organizationName });

    await acknowledgeIrreversibleAction(dialog, user);
    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      'Example Organization',
    );
    expect(getDeleteAction(dialog)).toBeDisabled();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      organizationName,
    );
    expect(
      within(dialog).getByText(
        (_, element) =>
          element?.tagName === 'CODE' &&
          element.textContent === organizationName,
      ),
    ).toBeInTheDocument();
    expect(getDeleteAction(dialog)).toBeEnabled();
  });

  it.each([
    null,
    '',
  ])('fails closed when the organization name is %j', async (organizationName) => {
    const { dialog } = await openDeleteDialog({ organizationName });

    expect(
      within(dialog).getByText('Organization confirmation is unavailable.'),
    ).toBeInTheDocument();
    expect(getConfirmationInput(dialog)).toBeDisabled();
    expect(dialog).not.toHaveTextContent('undefined');
    expect(dialog).not.toHaveTextContent('null');
    expect(getDeleteAction(dialog)).toBeDisabled();

    submitDeleteForm(dialog);

    expect(mocks.execPromiseWithErrorToast).not.toHaveBeenCalled();
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();
  });

  it('requires both the exact organization name and irreversible acknowledgment', async () => {
    const { dialog, user } = await openDeleteDialog();

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      'Example Organization',
    );
    expect(getDeleteAction(dialog)).toBeDisabled();

    await acknowledgeIrreversibleAction(dialog, user);
    expect(getDeleteAction(dialog)).toBeEnabled();

    await acknowledgeIrreversibleAction(dialog, user);
    expect(getDeleteAction(dialog)).toBeDisabled();
  });

  it('supports native paste and accessible, narrowly non-selectable name markup', async () => {
    const { dialog, user } = await openDeleteDialog();
    const input = within(dialog).getByLabelText(
      'Type Example Organization to confirm',
    );
    const name = within(dialog).getByText('Example Organization');

    await user.click(input);
    await user.paste('Example Organization');

    expect(input).toHaveValue('Example Organization');
    expect(input).not.toHaveAttribute('placeholder');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(name).toHaveClass(
      'select-none',
      'whitespace-pre-wrap',
      'break-words',
    );
    expect(name.parentElement).not.toHaveClass('select-none');
    expect(input).not.toHaveClass('select-none');
    expect(dialog).not.toHaveClass('select-none');
  });

  it('flags a cleared confirmation only after it has been touched', async () => {
    const { dialog } = await openDeleteDialog();
    const input = getConfirmationInput(dialog);

    expect(input).toHaveAttribute('aria-invalid', 'false');

    await TestUserEvent.fireTypeEvent(input, 'Example Organization');
    await TestUserEvent.fireTypeEvent(input, '');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(getDeleteAction(dialog)).toBeDisabled();
  });

  it('distinguishes the empty and mismatched confirmation messages', async () => {
    const { dialog } = await openDeleteDialog();
    const input = getConfirmationInput(dialog);
    const dialogQueries = within(dialog);

    await TestUserEvent.fireTypeEvent(input, 'wrong value');

    expect(dialogQueries.getByText('Value does not match')).toBeInTheDocument();
    expect(
      dialogQueries.queryByText('Typing the organization name is required'),
    ).not.toBeInTheDocument();

    await TestUserEvent.fireTypeEvent(input, '');

    expect(
      dialogQueries.getByText('Typing the organization name is required'),
    ).toBeInTheDocument();
    expect(
      dialogQueries.queryByText('Value does not match'),
    ).not.toBeInTheDocument();

    await TestUserEvent.fireTypeEvent(input, 'Example Organization');

    expect(
      dialogQueries.queryByText('Typing the organization name is required'),
    ).not.toBeInTheDocument();
    expect(
      dialogQueries.queryByText('Value does not match'),
    ).not.toBeInTheDocument();
  });

  it('never renders validation text for the acknowledgment', async () => {
    const { dialog, user } = await openDeleteDialog();

    await acknowledgeIrreversibleAction(dialog, user);
    await acknowledgeIrreversibleAction(dialog, user);

    expect(dialog).not.toHaveTextContent(/invalid/i);
    expect(dialog).not.toHaveTextContent(/required/i);
  });

  it('flags a non-matching value and clears the error once it matches', async () => {
    const { dialog } = await openDeleteDialog();
    const input = getConfirmationInput(dialog);

    await TestUserEvent.fireTypeEvent(input, 'Example');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass(
      'aria-[invalid=true]:border-red-500',
      'aria-[invalid=true]:focus:border-red-500',
      'aria-[invalid=true]:focus:ring-red-500',
    );

    await TestUserEvent.fireTypeEvent(input, 'Example Organization');

    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('renders the confirmation input after the acknowledgment checkbox', async () => {
    const { dialog } = await openDeleteDialog();
    const acknowledgment = within(dialog).getByRole('checkbox', {
      name: 'I understand this action cannot be undone',
    });

    expect(
      acknowledgment.compareDocumentPosition(getConfirmationInput(dialog)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the outer trigger disabled and shows guidance for non-admins', () => {
    renderDeleteOrg({ isAdmin: false });

    expect(
      screen.getByText(
        'Only organization admins can delete this organization.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fails closed if admin access changes while the dialog is open', async () => {
    const { dialog, rerender, user } = await openDeleteDialog();
    await enableOrganizationDeletion(dialog, user);
    expect(getDeleteAction(dialog)).toBeEnabled();

    mocks.useIsOrgAdmin.mockReturnValue(false);
    rerender(<DeleteOrg />);

    expect(getDeleteAction(dialog)).toBeDisabled();
    submitDeleteForm(dialog);

    expect(mocks.execPromiseWithErrorToast).not.toHaveBeenCalled();
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();
  });

  it('cancels without invoking the deletion flow', async () => {
    const { dialog, user } = await openDeleteDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mocks.execPromiseWithErrorToast).not.toHaveBeenCalled();
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();
  });

  // Enter submits natively in the browser. jsdom does not run the form
  // submission algorithm inside a Radix portal, so the submit event is
  // dispatched directly instead of typing '{Enter}'.
  it('deletes when the form is submitted, and ignores submits while invalid', async () => {
    const { dialog, user } = await openDeleteDialog();
    const form = getConfirmationInput(dialog).closest('form');

    await TestUserEvent.fireTypeEvent(
      getConfirmationInput(dialog),
      'wrong value',
    );
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(getConfirmationInput(dialog)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();

    await enableOrganizationDeletion(dialog, user);
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.deleteOrgMutation).toHaveBeenCalledTimes(1);
    });
  });

  it('closes when clicking outside the dialog', async () => {
    await openDeleteDialog();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mocks.execPromiseWithErrorToast).not.toHaveBeenCalled();
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();
  });

  it('stays open when clicking outside while the deletion is pending', async () => {
    mocks.deleteOrgMutation.mockImplementation(
      () => new Promise<never>(() => {}),
    );
    const { dialog, user } = await openDeleteDialog();
    await enableOrganizationDeletion(dialog, user);

    submitDeleteForm(dialog);
    await waitFor(() => {
      expect(
        getDeleteAction(dialog).querySelector('.animate-spin'),
      ).toBeTruthy();
    });

    fireEvent.pointerDown(document.body);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
    expect(getConfirmationInput(reopenedDialog)).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(
      within(reopenedDialog).queryByText(/Value does not match/),
    ).not.toBeInTheDocument();
    expect(
      within(reopenedDialog).getByRole('checkbox', {
        name: 'I understand this action cannot be undone',
      }),
    ).not.toBeChecked();
    expect(getDeleteAction(reopenedDialog)).toBeDisabled();
  });

  it('shows pending state, disables actions, and guards against repeated deletion', async () => {
    mocks.deleteOrgMutation.mockImplementation(
      () => new Promise<never>(() => {}),
    );
    const { dialog, user } = await openDeleteDialog();
    await enableOrganizationDeletion(dialog, user);

    submitDeleteForm(dialog);

    await waitFor(() => {
      expect(
        getDeleteAction(dialog).querySelector('.animate-spin'),
      ).toBeTruthy();
    });
    expect(getDeleteAction(dialog)).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();

    submitDeleteForm(dialog);
    expect(mocks.deleteOrgMutation).toHaveBeenCalledTimes(1);
  });

  it('defensively rejects an invalid click before setting pending state or mutating', async () => {
    const { dialog } = await openDeleteDialog();
    const action = getDeleteAction(dialog);

    action.removeAttribute('disabled');
    fireEvent.click(action);

    expect(mocks.execPromiseWithErrorToast).not.toHaveBeenCalled();
    expect(mocks.deleteOrgMutation).not.toHaveBeenCalled();
    expect(action.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeEnabled();
  });

  it('preserves mutation variables, toast contract, completion, refetch, and navigation', async () => {
    mocks.deleteOrgMutation.mockImplementation(
      async ({ onCompleted }: { onCompleted?: () => Promise<void> }) => {
        await onCompleted?.();
        return {};
      },
    );
    const { dialog, user } = await openDeleteDialog();
    await enableOrganizationDeletion(dialog, user);

    submitDeleteForm(dialog);

    await waitFor(() => {
      expect(mocks.deleteOrgMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'organization-id' },
          onCompleted: expect.any(Function),
        }),
      );
    });
    expect(mocks.execPromiseWithErrorToast).toHaveBeenCalledWith(
      expect.any(Function),
      {
        loadingMessage: 'Deleting the organization',
        successMessage: 'Successfully deleted the organization',
        errorMessage: 'An error occurred while deleting the organization!',
      },
    );
    expect(mocks.refetchOrgs).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('delegates mutation failures to the existing toast wrapper', async () => {
    const error = new Error('delete failed');
    let delegatedError: unknown;
    mocks.deleteOrgMutation.mockRejectedValue(error);
    mocks.execPromiseWithErrorToast.mockImplementation(
      async (call: () => Promise<unknown>) => {
        try {
          await call();
        } catch (caughtError) {
          delegatedError = caughtError;
        }
        return null;
      },
    );
    const { dialog, user } = await openDeleteDialog();
    await enableOrganizationDeletion(dialog, user);

    submitDeleteForm(dialog);

    await waitFor(() => {
      expect(delegatedError).toBe(error);
    });
    expect(mocks.execPromiseWithErrorToast).toHaveBeenCalledWith(
      expect.any(Function),
      {
        loadingMessage: 'Deleting the organization',
        successMessage: 'Successfully deleted the organization',
        errorMessage: 'An error occurred while deleting the organization!',
      },
    );
    expect(mocks.refetchOrgs).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
