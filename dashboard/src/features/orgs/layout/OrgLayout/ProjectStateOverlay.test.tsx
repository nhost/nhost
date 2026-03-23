import { vi } from 'vitest';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import ProjectStateOverlay from './ProjectStateOverlay';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useAppState: vi.fn(),
  useAppPausedReason: vi.fn(),
  useProject: vi.fn(),
  useUserData: vi.fn(),
  useUnpauseApplicationMutation: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('next/image', () => ({
  __esModule: true,
  // biome-ignore lint/a11y/useAltText: test mock
  // biome-ignore lint/performance/noImgElement: test mock
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppPausedReason', () => ({
  useAppPausedReason: mocks.useAppPausedReason,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/utils/__generated__/graphql',
  );
  return {
    ...actual,
    useUnpauseApplicationMutation: mocks.useUnpauseApplicationMutation,
  };
});

const overlayRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/hasura';
const nonOverlayRoute = '/orgs/[orgSlug]/projects/[appSubdomain]';

function getRouterMock(route: string) {
  return {
    basePath: '',
    pathname: '/orgs/xyz/projects/test-project',
    route,
    asPath: '/orgs/xyz/projects/test-project',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isFallback: false,
  };
}

function setupDefaultMocks(overrides?: {
  route?: string;
  state?: ApplicationStatus;
  freeAndLiveProjectsNumberExceeded?: boolean;
}) {
  const {
    route = overlayRoute,
    state = ApplicationStatus.Paused,
    freeAndLiveProjectsNumberExceeded = false,
  } = overrides ?? {};

  mocks.useRouter.mockReturnValue(getRouterMock(route));
  mocks.useAppState.mockReturnValue({ state });
  mocks.useAppPausedReason.mockReturnValue({
    isLocked: false,
    lockedReason: '',
    freeAndLiveProjectsNumberExceeded,
    loading: false,
  });
  mocks.useProject.mockReturnValue({
    project: { id: 'test-project-id', name: 'Test Project' },
    refetch: vi.fn(),
  });
  mocks.useUserData.mockReturnValue({ id: 'test-user-id' });
  mocks.useUnpauseApplicationMutation.mockReturnValue([
    vi.fn(),
    { loading: false },
  ]);
}

describe('ProjectStateOverlay', () => {
  beforeAll(() => {
    mockPointerEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('route gating', () => {
    it('should render nothing on non-overlay routes', () => {
      setupDefaultMocks({ route: nonOverlayRoute });
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.queryByText(
          'This project is paused. Unpause to make this available.',
        ),
      ).not.toBeInTheDocument();
    });

    it('should render the overlay on overlay routes', () => {
      setupDefaultMocks({ route: overlayRoute });
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.getByText(
          'This project is paused. Unpause to make this available.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('paused variant', () => {
    it('should show the paused message', () => {
      setupDefaultMocks();
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.getByText(
          'This project is paused. Unpause to make this available.',
        ),
      ).toBeInTheDocument();
    });

    it('should show the wake up button when state is Paused', () => {
      setupDefaultMocks({ state: ApplicationStatus.Paused });
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.getByRole('button', { name: 'Wake up' }),
      ).toBeInTheDocument();
    });

    it('should hide the wake up button when state is not Paused', () => {
      setupDefaultMocks({ state: ApplicationStatus.Pausing });
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.queryByRole('button', { name: 'Wake up' }),
      ).not.toBeInTheDocument();
    });

    it('should show free project limit message when exceeded', () => {
      setupDefaultMocks({ freeAndLiveProjectsNumberExceeded: true });
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.getByText(/Only 1 free project can be active at a time/),
      ).toBeInTheDocument();
    });

    it('should hide free project limit message when not exceeded', () => {
      setupDefaultMocks({ freeAndLiveProjectsNumberExceeded: false });
      render(<ProjectStateOverlay variant="paused" />);
      expect(
        screen.queryByText(/Only 1 free project can be active at a time/),
      ).not.toBeInTheDocument();
    });
  });

  describe('dismissal', () => {
    it('should hide the overlay when the close button is clicked', async () => {
      setupDefaultMocks();
      const user = new TestUserEvent();
      render(<ProjectStateOverlay variant="paused" />);

      expect(
        screen.getByText(
          'This project is paused. Unpause to make this available.',
        ),
      ).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText(
            'This project is paused. Unpause to make this available.',
          ),
        ).not.toBeInTheDocument();
      });
    });

    it('should re-show the overlay after a route change', async () => {
      setupDefaultMocks({ route: overlayRoute });
      const user = new TestUserEvent();
      const { rerender } = render(<ProjectStateOverlay variant="paused" />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText(
            'This project is paused. Unpause to make this available.',
          ),
        ).not.toBeInTheDocument();
      });

      const newRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/database';
      mocks.useRouter.mockReturnValue(getRouterMock(newRoute));

      rerender(<ProjectStateOverlay variant="paused" />);

      expect(
        screen.getByText(
          'This project is paused. Unpause to make this available.',
        ),
      ).toBeInTheDocument();
    });
  });
});
