import { vi } from 'vitest';
import ApplicationUnknown from '@/features/orgs/projects/common/components/ApplicationUnknown/ApplicationUnknown';
import { mockApplication, mockOrganization } from '@/tests/mocks';
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
  deleteApplication: vi.fn(),
  discordAnnounce: vi.fn(),
  push: vi.fn(),
  track: vi.fn(),
  triggerToast: vi.fn(),
  useBillingDeleteAppMutation: vi.fn(),
  useIsCurrentUserOwner: vi.fn(),
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

vi.mock('@/features/orgs/projects/common/hooks/useIsCurrentUserOwner', () => ({
  useIsCurrentUserOwner: mocks.useIsCurrentUserOwner,
}));

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

mockPointerEvent();

function setupProject(projectName: string) {
  mocks.useProject.mockReturnValue({
    project: {
      ...mockApplication,
      id: 'unknown-project-id',
      name: projectName,
    },
    loading: false,
  });
}

function normalizeCopy(value: string | null) {
  return value?.replace(/\s+/g, ' ').trim();
}

async function openDeleteDialog() {
  const user = new TestUserEvent();
  render(<ApplicationUnknown />);
  await user.click(screen.getByRole('button', { name: 'Delete Project' }));

  return {
    dialog: await screen.findByRole('dialog'),
    user,
  };
}

describe('ApplicationUnknown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_ENV = 'production';
    setupProject('Unknown Project');
    mocks.deleteApplication.mockResolvedValue({});
    mocks.discordAnnounce.mockResolvedValue(undefined);
    mocks.push.mockResolvedValue(true);
    mocks.useBillingDeleteAppMutation.mockReturnValue([
      mocks.deleteApplication,
    ]);
    mocks.useIsCurrentUserOwner.mockReturnValue(true);
    mocks.useOrgs.mockReturnValue({
      currentOrg: {
        ...mockOrganization,
        name: 'Example Org',
        slug: 'example-org',
        plan: { ...mockOrganization.plan, isFree: true },
      },
    });
    mocks.useTrackEvent.mockReturnValue(mocks.track);
    mocks.useUserData.mockReturnValue({ id: 'user-id' });
  });

  it('keeps visible and screen-reader copy aligned with narrowly non-selectable names', async () => {
    const { dialog } = await openDeleteDialog();
    const headings = Array.from(dialog.querySelectorAll('h2'));
    const descriptions = Array.from(dialog.querySelectorAll('p')).filter(
      (element) => element.textContent?.includes('will be removed'),
    );
    const visibleTitle = headings.find(
      (element) => !element.classList.contains('sr-only'),
    );
    const screenReaderTitle = headings.find((element) =>
      element.classList.contains('sr-only'),
    );
    const visibleDescription = descriptions.find(
      (element) => !element.classList.contains('sr-only'),
    );
    const screenReaderDescription = descriptions.find((element) =>
      element.classList.contains('sr-only'),
    );

    expect(normalizeCopy(visibleTitle?.textContent ?? null)).toBe(
      normalizeCopy(screenReaderTitle?.textContent ?? null),
    );
    expect(normalizeCopy(visibleDescription?.textContent ?? null)).toBe(
      normalizeCopy(screenReaderDescription?.textContent ?? null),
    );
    expect(dialog).toHaveAccessibleName('Remove project Unknown Project?');
    expect(dialog).toHaveAccessibleDescription(
      'The project Unknown Project will be removed. All data will be lost and there will be no way to recover the app once it has been deleted.',
    );

    const projectNameSpans = within(dialog).getAllByText('Unknown Project', {
      selector: 'span',
    });
    expect(projectNameSpans).toHaveLength(4);

    projectNameSpans.forEach((nameSpan) => {
      expect(nameSpan).toHaveClass(
        'select-none',
        'whitespace-pre-wrap',
        'break-words',
      );
      expect(nameSpan.parentElement).not.toHaveClass('select-none');
    });
    expect(dialog).not.toHaveClass('select-none');
    expect(visibleTitle).not.toHaveClass('select-none');
    expect(visibleDescription).not.toHaveClass('select-none');
  });

  it('passes ReactNode copy into the real modal and preserves default deletion wiring', async () => {
    const { dialog, user } = await openDeleteDialog();
    const dialogQueries = within(dialog);
    const input = dialogQueries.getByRole('textbox');

    await TestUserEvent.fireTypeEvent(input, 'Example Org/Unknown Project');
    await user.click(
      dialogQueries.getByRole('checkbox', {
        name: 'Confirm Delete Project #2',
      }),
    );
    // The delete action is a submit button. jsdom does not run the form
    // submission algorithm inside a Radix portal, so the submit event is
    // dispatched directly instead of clicking the button.
    fireEvent.submit(
      dialogQueries.getByRole('textbox').closest('form') as HTMLFormElement,
    );

    await waitFor(() => {
      expect(mocks.deleteApplication).toHaveBeenCalledWith({
        variables: { appID: 'unknown-project-id' },
      });
    });
    expect(mocks.track).toHaveBeenCalledWith('Project Deleted');
    expect(mocks.push).toHaveBeenCalledWith('/orgs/example-org/projects');
    expect(mocks.triggerToast).toHaveBeenCalledWith('Unknown Project deleted');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('blocks dismissal and disables cancel while the deletion is pending', async () => {
    mocks.deleteApplication.mockImplementation(
      () => new Promise<never>(() => {}),
    );
    const { dialog, user } = await openDeleteDialog();
    const dialogQueries = within(dialog);

    await TestUserEvent.fireTypeEvent(
      dialogQueries.getByRole('textbox'),
      'Example Org/Unknown Project',
    );
    await user.click(
      dialogQueries.getByRole('checkbox', {
        name: 'Confirm Delete Project #2',
      }),
    );
    // The delete action is a submit button. jsdom does not run the form
    // submission algorithm inside a Radix portal, so the submit event is
    // dispatched directly instead of clicking the button.
    fireEvent.submit(
      dialogQueries.getByRole('textbox').closest('form') as HTMLFormElement,
    );

    await waitFor(() => {
      expect(
        dialogQueries.getByRole('button', { name: 'Cancel' }),
      ).toBeDisabled();
    });

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('uses aligned fallback copy and fails closed when the project name is empty', async () => {
    setupProject('');

    const { dialog } = await openDeleteDialog();

    expect(dialog).toHaveAccessibleName('Remove this project?');
    expect(dialog).toHaveAccessibleDescription(
      'This project will be removed. All data will be lost and there will be no way to recover the app once it has been deleted.',
    );
    expect(
      within(dialog).getAllByRole('heading', { name: 'Remove this project?' }),
    ).toHaveLength(2);
    expect(
      within(dialog).getByText('Project confirmation is unavailable.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox')).toBeDisabled();
    expect(dialog).not.toHaveTextContent('undefined');
    expect(dialog).not.toHaveTextContent('null');
    expect(mocks.deleteApplication).not.toHaveBeenCalled();
  });
});
