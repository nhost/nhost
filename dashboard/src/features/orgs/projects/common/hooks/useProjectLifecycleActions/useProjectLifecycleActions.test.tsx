import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { AppState } from '@/features/orgs/projects/common/hooks/useAppState';
import useProjectLifecycleActions from '@/features/orgs/projects/common/hooks/useProjectLifecycleActions/useProjectLifecycleActions';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import { mockApplication } from '@/tests/mocks';
import { act, queryClient, renderHook } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

interface ToastOptions {
  loadingMessage: string;
  successMessage: string;
  errorMessage: string | ((error: Error) => string);
}

const mocks = vi.hoisted(() => ({
  routeSubdomain: 'test-project',
  pauseLoading: false,
  wakeLoading: false,
  pauseApplication: vi.fn(),
  wakeApplication: vi.fn(),
  pauseMutationOptions: null as unknown,
  wakeMutationOptions: null as unknown,
  toastOptions: [] as ToastOptions[],
  track: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { appSubdomain: mocks.routeSubdomain },
  }),
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...original,
    GetOrganizationsDocument: { kind: 'Document' },
    usePauseApplicationMutation: (options: unknown) => {
      mocks.pauseMutationOptions = options;
      return [mocks.pauseApplication, { loading: mocks.pauseLoading }];
    },
    useUnpauseApplicationMutation: (options: unknown) => {
      mocks.wakeMutationOptions = options;
      return [mocks.wakeApplication, { loading: mocks.wakeLoading }];
    },
  };
});

vi.mock('@/hooks/useUserData', () => ({
  useUserData: () => ({ id: 'user-id' }),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({ currentOrg: { id: 'organization-id' } }),
}));

vi.mock('@/lib/segment', () => ({
  analytics: { track: mocks.track },
}));

vi.mock('@/features/orgs/utils/execPromiseWithErrorToast', () => ({
  execPromiseWithErrorToast: vi.fn(
    async (call: () => Promise<unknown>, options: ToastOptions) => {
      mocks.toastOptions.push(options);
      try {
        return await call();
      } catch {
        return null;
      }
    },
  ),
}));

const defaultAppState: AppState = {
  state: ApplicationStatus.Live,
  desiredState: ApplicationStatus.Live,
  project: {
    ...mockApplication,
    id: 'project-id',
    name: 'Test Project',
    subdomain: 'test-project',
  },
};

const pausedAppState: AppState = {
  ...defaultAppState,
  state: ApplicationStatus.Paused,
  desiredState: ApplicationStatus.Paused,
};

function QueryWrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderLifecycleHook(appState: AppState = defaultAppState) {
  return renderHook(
    ({ snapshot }: { snapshot: AppState }) =>
      useProjectLifecycleActions(snapshot),
    {
      initialProps: { snapshot: appState },
      wrapper: QueryWrapper,
    },
  );
}

function createDeferredPromise() {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('useProjectLifecycleActions', () => {
  beforeEach(() => {
    mocks.routeSubdomain = 'test-project';
    mocks.pauseLoading = false;
    mocks.wakeLoading = false;
    mocks.pauseApplication.mockReset().mockResolvedValue({});
    mocks.wakeApplication.mockReset().mockResolvedValue({});
    mocks.track.mockReset();
    mocks.pauseMutationOptions = null;
    mocks.wakeMutationOptions = null;
    mocks.toastOptions = [];
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('synchronously prevents direct pause and wake reentry', async () => {
    const pauseRequest = createDeferredPromise();
    mocks.pauseApplication.mockReturnValue(pauseRequest.promise);
    const pauseHook = renderLifecycleHook();

    let firstPause: Promise<void>;
    let secondPause: Promise<void>;
    act(() => {
      firstPause = pauseHook.result.current.pauseProject();
      secondPause = pauseHook.result.current.pauseProject();
    });

    expect(mocks.pauseApplication).toHaveBeenCalledOnce();
    pauseRequest.resolve({});
    await act(async () => {
      await Promise.all([firstPause, secondPause]);
    });

    pauseHook.unmount();

    const wakeRequest = createDeferredPromise();
    mocks.wakeApplication.mockReturnValue(wakeRequest.promise);
    const wakeHook = renderLifecycleHook(pausedAppState);

    let firstWake: Promise<void>;
    let secondWake: Promise<void>;
    act(() => {
      firstWake = wakeHook.result.current.wakeUpProject();
      secondWake = wakeHook.result.current.wakeUpProject();
    });

    expect(mocks.wakeApplication).toHaveBeenCalledOnce();
    wakeRequest.resolve({});
    await act(async () => {
      await Promise.all([firstWake, secondWake]);
    });
  });

  it('enables only Pause for Live -> Live and only Wake Up for Paused -> Paused', async () => {
    const liveHook = renderLifecycleHook();

    expect(liveHook.result.current.pauseDisabled).toBe(false);
    expect(liveHook.result.current.wakeUpDisabled).toBe(true);
    await act(async () => {
      await liveHook.result.current.wakeUpProject();
    });
    expect(mocks.wakeApplication).not.toHaveBeenCalled();

    liveHook.unmount();
    const pausedHook = renderLifecycleHook(pausedAppState);

    expect(pausedHook.result.current.pauseDisabled).toBe(true);
    expect(pausedHook.result.current.wakeUpDisabled).toBe(false);
    await act(async () => {
      await pausedHook.result.current.pauseProject();
    });
    expect(mocks.pauseApplication).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'Live -> Paused',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Paused -> Live',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Paused -> Migrating',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Migrating,
    },
    {
      label: 'Pausing -> Paused',
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Errored -> Paused',
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Paused,
    },
  ])('disables both actions for $label', async ({ state, desiredState }) => {
    const { result } = renderLifecycleHook({
      ...defaultAppState,
      state,
      desiredState,
    });

    expect(result.current.pauseDisabled).toBe(true);
    expect(result.current.wakeUpDisabled).toBe(true);
    await act(async () => {
      await result.current.pauseProject();
      await result.current.wakeUpProject();
    });

    expect(mocks.pauseApplication).not.toHaveBeenCalled();
    expect(mocks.wakeApplication).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'Errored -> Live', state: ApplicationStatus.Errored },
    { label: 'Updating -> Live', state: ApplicationStatus.Updating },
    { label: 'Unpausing -> Live', state: ApplicationStatus.Unpausing },
    { label: 'Migrating -> Live', state: ApplicationStatus.Migrating },
    { label: 'Restoring -> Live', state: ApplicationStatus.Restoring },
  ])('keeps Pause actionable for $label', async ({ state }) => {
    const { result } = renderLifecycleHook({
      ...defaultAppState,
      state,
    });

    expect(result.current.pauseDisabled).toBe(false);
    await act(async () => {
      await result.current.pauseProject();
    });

    expect(mocks.pauseApplication).toHaveBeenCalledOnce();
  });

  it('rejects actions for missing and cross-route projects', async () => {
    const missingProjectHook = renderLifecycleHook({
      ...defaultAppState,
      project: null,
    });

    expect(missingProjectHook.result.current.pauseDisabled).toBe(true);
    expect(missingProjectHook.result.current.wakeUpDisabled).toBe(true);
    await act(async () => {
      await missingProjectHook.result.current.pauseProject();
      await missingProjectHook.result.current.wakeUpProject();
    });

    missingProjectHook.unmount();
    const crossRouteHook = renderLifecycleHook({
      ...defaultAppState,
      project: {
        ...defaultAppState.project!,
        subdomain: 'previous-project',
      },
    });

    expect(crossRouteHook.result.current.pauseDisabled).toBe(true);
    expect(crossRouteHook.result.current.wakeUpDisabled).toBe(true);
    await act(async () => {
      await crossRouteHook.result.current.pauseProject();
      await crossRouteHook.result.current.wakeUpProject();
    });

    expect(mocks.pauseApplication).not.toHaveBeenCalled();
    expect(mocks.wakeApplication).not.toHaveBeenCalled();
  });

  it('clears a rejected mutation and permits retry', async () => {
    mocks.pauseApplication
      .mockRejectedValueOnce(new Error('request rejected'))
      .mockResolvedValueOnce({});
    const { result, rerender } = renderLifecycleHook();

    await act(async () => {
      await result.current.pauseProject();
    });
    rerender({ snapshot: defaultAppState });

    expect(result.current.pauseDisabled).toBe(false);
    expect(mocks.track).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.pauseProject();
    });

    expect(mocks.pauseApplication).toHaveBeenCalledTimes(2);
  });

  it('retains an accepted request through unchanged stale and error refreshes', async () => {
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValueOnce(
      new Error('refresh failed'),
    );
    const { result, rerender } = renderLifecycleHook();

    await act(async () => {
      await result.current.pauseProject();
    });
    rerender({
      snapshot: {
        ...defaultAppState,
        project: { ...defaultAppState.project! },
      },
    });

    expect(mocks.pauseApplication).toHaveBeenCalledOnce();
    expect(result.current.pauseDisabled).toBe(true);
  });

  it('hands request protection off to application state', async () => {
    const { result, rerender } = renderLifecycleHook();

    await act(async () => {
      await result.current.pauseProject();
    });

    rerender({
      snapshot: {
        ...pausedAppState,
        state: ApplicationStatus.Pausing,
      },
    });
    rerender({ snapshot: pausedAppState });

    expect(result.current.wakeUpDisabled).toBe(false);
  });

  it('preserves exact pause side effects and invalidations in order', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderLifecycleHook();

    await act(async () => {
      await result.current.pauseProject();
    });

    expect(mocks.track).toHaveBeenCalledWith('Project Paused', {
      reason: 'manual',
      org_id: 'organization-id',
      project_id: 'project-id',
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['projectWithState', 'test-project'],
      exact: true,
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['project', 'test-project'],
      exact: true,
    });
    expect(mocks.track.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateQueries.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(mocks.pauseMutationOptions).toEqual({
      refetchQueries: [
        {
          query: { kind: 'Document' },
          variables: { userId: 'user-id' },
        },
      ],
    });
    expect(mocks.toastOptions[0]?.loadingMessage).toBe(
      'Pausing Test Project...',
    );
    expect(mocks.toastOptions[0]?.successMessage).toBe(
      'Test Project will be paused, but please note that it may take some time to complete the process.',
    );
    const errorMessage = mocks.toastOptions[0]?.errorMessage;
    expect(errorMessage).toBeTypeOf('function');
    if (typeof errorMessage !== 'function') {
      throw new Error('Expected pause errorMessage to be a resolver.');
    }
    expect(errorMessage(new Error('request failed'))).toBe(
      'An error occurred while trying to pause the project "Test Project". Please try again.',
    );
  });

  it('preserves exact wake side effects and toast contracts', async () => {
    const { result } = renderLifecycleHook(pausedAppState);

    await act(async () => {
      await result.current.wakeUpProject();
    });

    expect(mocks.track).toHaveBeenCalledWith('Project Resumed', {
      org_id: 'organization-id',
      project_id: 'project-id',
    });
    expect(mocks.toastOptions[0]).toEqual({
      loadingMessage: 'Starting the project...',
      successMessage: 'The project has been started successfully.',
      errorMessage: getUnpauseErrorMessage,
    });
    expect(mocks.wakeMutationOptions).toEqual({
      refetchQueries: [
        {
          query: { kind: 'Document' },
          variables: { userId: 'user-id' },
        },
      ],
    });
  });
});
