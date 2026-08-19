import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import GeneralSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { prefetchNewAppQuery } from '@/tests/msw/mocks/graphql/prefetchNewAppQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  cleanup,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const ORIGINAL_PROJECT_NAME = 'Original project';
const OTHER_PROJECT_NAME = 'Other project';
const RENAMED_PROJECT_NAME = 'Renamed project';
let storedProjectName = ORIGINAL_PROJECT_NAME;

const project = () => ({
  ...mockApplication,
  __typename: 'apps' as const,
  name: storedProjectName,
});

const projectWithState = (state: ApplicationStatus) => ({
  ...project(),
  appStates: [{ stateId: state }],
});

const otherProject = {
  ...mockApplication,
  __typename: 'apps' as const,
  id: '2',
  name: OTHER_PROJECT_NAME,
  slug: 'other-project',
  subdomain: 'other-project',
};

const otherProjectWithState = (state: ApplicationStatus) => ({
  ...otherProject,
  appStates: [{ stateId: state }],
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

const organization = () => ({
  ...mockOrganization,
  apps: [project(), otherProject].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
});

function registerNavigationHandlers(
  action: 'pause' | 'unpause',
  state: ApplicationStatus,
) {
  const projectBStateResponse =
    createDeferred<ReturnType<typeof otherProjectWithState>>();
  const projectAMutationResponse = createDeferred<void>();
  const projectBMutationResponse = createDeferred<void>();
  const mutationRequests = vi.fn();
  const mutationResponses = vi.fn();

  server.use(
    nhostGraphQLLink.query('getProject', ({ variables }) =>
      HttpResponse.json({
        data: {
          apps: [
            variables.subdomain === otherProject.subdomain
              ? otherProject
              : project(),
          ],
        },
      }),
    ),
    nhostGraphQLLink.query('getProjectState', async ({ variables }) => {
      const stateProject =
        variables.subdomain === otherProject.subdomain
          ? await projectBStateResponse.promise
          : projectWithState(state);

      return HttpResponse.json({ data: { apps: [stateProject] } });
    }),
    nhostGraphQLLink.mutation(
      action === 'pause' ? 'PauseApplication' : 'UnpauseApplication',
      async ({ variables }) => {
        const projectId = variables.appId;
        mutationRequests(projectId);

        if (projectId === mockApplication.id) {
          await projectAMutationResponse.promise;
        } else if (projectId === otherProject.id) {
          await projectBMutationResponse.promise;
        }

        mutationResponses(projectId);

        const projectName =
          projectId === otherProject.id
            ? OTHER_PROJECT_NAME
            : ORIGINAL_PROJECT_NAME;

        return HttpResponse.json({
          errors: [
            {
              message:
                action === 'pause'
                  ? `app is locked: ${projectName}`
                  : `organization needs attention: ${projectName}`,
            },
          ],
        });
      },
    ),
  );

  return {
    mutationRequests,
    mutationResponses,
    projectAMutationResponse,
    projectBMutationResponse,
    projectBStateResponse,
  };
}

const server = setupServer(
  tokenQuery,
  prefetchNewAppQuery,
  nhostGraphQLLink.query('getProject', () =>
    HttpResponse.json({ data: { apps: [project()] } }),
  ),
  nhostGraphQLLink.query('getProjectState', () =>
    HttpResponse.json({ data: { apps: [project()] } }),
  ),
  nhostGraphQLLink.query('getOrganizations', () =>
    HttpResponse.json({ data: { organizations: [organization()] } }),
  ),
  nhostGraphQLLink.query('getOrganization', () =>
    HttpResponse.json({ data: { organizations: [organization()] } }),
  ),
  nhostGraphQLLink.query('getRunServices', () =>
    HttpResponse.json({
      data: {
        app: {
          runServices: [],
          runServices_aggregate: { aggregate: { count: 0 } },
        },
      },
    }),
  ),
  nhostGraphQLLink.mutation('updateApplication', ({ variables }) => {
    storedProjectName = variables.app.name;

    return HttpResponse.json({
      data: {
        updateApp: {
          __typename: 'apps',
          id: mockApplication.id,
          name: storedProjectName,
          slug: variables.app.slug,
          subdomain: mockApplication.subdomain,
        },
      },
    });
  }),
);

function ProjectNameConsumers() {
  const { currentOrg } = useOrgs();
  const { project: currentProject } = useProject();

  return (
    <>
      <p>
        Organization projects:{' '}
        {currentOrg?.apps.map(({ name }) => name).join(', ')}
      </p>
      <p>Project query: {currentProject?.name}</p>
    </>
  );
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

beforeEach(() => {
  server.resetHandlers();
  storedProjectName = ORIGINAL_PROJECT_NAME;
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  mockRouter.query.appSubdomain = mockApplication.subdomain;
  cleanup();
  queryClient.clear();
  vi.mocked(mockRouter.push).mockClear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => server.close());

describe('GeneralSettingsPage', () => {
  it('refreshes project data and organization project ordering after a rename', async () => {
    const user = new TestUserEvent();
    render(
      <>
        <ProjectNameConsumers />
        <GeneralSettingsPage />
      </>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          `Organization projects: ${ORIGINAL_PROJECT_NAME}, ${OTHER_PROJECT_NAME}`,
        ),
      ).toBeVisible();
      expect(
        screen.getByText(`Project query: ${ORIGINAL_PROJECT_NAME}`),
      ).toBeVisible();
    });

    const nameInput = await screen.findByRole('textbox', {
      name: 'Project Name',
    });
    await user.clear(nameInput);
    await user.type(nameInput, RENAMED_PROJECT_NAME);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        `Organization projects: ${OTHER_PROJECT_NAME}, ${RENAMED_PROJECT_NAME}`,
      ),
    ).toBeVisible();
    expect(
      await screen.findByText(`Project query: ${RENAMED_PROJECT_NAME}`),
    ).toBeVisible();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('shows an error when the organization refresh fails', async () => {
    server.use(
      nhostGraphQLLink.query('getOrganizations', () => {
        if (storedProjectName === RENAMED_PROJECT_NAME) {
          return HttpResponse.json({
            errors: [{ message: 'Organization refresh failed' }],
          });
        }

        return HttpResponse.json({
          data: { organizations: [organization()] },
        });
      }),
    );

    const user = new TestUserEvent();
    render(<GeneralSettingsPage />);

    const nameInput = await screen.findByRole('textbox', {
      name: 'Project Name',
    });
    await user.clear(nameInput);
    await user.type(nameInput, RENAMED_PROJECT_NAME);

    const successMessage = 'Project name has been updated successfully.';
    const errorMessage =
      'An error occurred while trying to update project name.';
    const initialSuccessMessageCount =
      screen.queryAllByText(successMessage).length;
    const initialErrorMessageCount = screen.queryAllByText(errorMessage).length;

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getAllByText(errorMessage)).toHaveLength(
        initialErrorMessageCount + 1,
      ),
    );
    expect(screen.queryAllByText(successMessage)).toHaveLength(
      initialSuccessMessageCount,
    );
    expect(nameInput).toHaveValue(RENAMED_PROJECT_NAME);
  });

  it('refreshes the project state query after pausing', async () => {
    let projectState = ApplicationStatus.Live;
    const getProject = vi.fn();
    const getProjectState = vi.fn();
    const pauseApplication = vi.fn();

    server.use(
      nhostGraphQLLink.query('getProject', () => {
        getProject();
        return HttpResponse.json({
          data: {
            apps: [projectWithState(ApplicationStatus.Paused)],
          },
        });
      }),
      nhostGraphQLLink.query('getProjectState', () => {
        getProjectState();
        return HttpResponse.json({
          data: { apps: [projectWithState(projectState)] },
        });
      }),
      nhostGraphQLLink.mutation('PauseApplication', () => {
        pauseApplication();
        projectState = ApplicationStatus.Pausing;
        return HttpResponse.json({
          data: { updateApp: { id: mockApplication.id } },
        });
      }),
    );

    const user = new TestUserEvent();
    render(<GeneralSettingsPage />);

    const pauseButton = await screen.findByRole('button', { name: 'Pause' });
    const initialGetProjectRequestCount = getProject.mock.calls.length;
    const initialGetProjectStateRequestCount =
      getProjectState.mock.calls.length;

    await user.click(pauseButton);
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(pauseApplication).toHaveBeenCalledOnce();
      expect(pauseButton).toBeDisabled();
    });

    expect(
      await screen.findByRole(
        'button',
        { name: 'Pausing...' },
        { timeout: 3000 },
      ),
    ).toBeDisabled();
    expect(getProject).toHaveBeenCalledTimes(initialGetProjectRequestCount);
    expect(getProjectState.mock.calls.length).toBeGreaterThan(
      initialGetProjectStateRequestCount,
    );
  });

  it('refreshes the project state query after unpausing', async () => {
    let projectState = ApplicationStatus.Paused;
    const getProject = vi.fn();
    const getProjectState = vi.fn();
    const unpauseApplication = vi.fn();

    server.use(
      nhostGraphQLLink.query('getProject', () => {
        getProject();
        return HttpResponse.json({
          data: {
            apps: [projectWithState(ApplicationStatus.Live)],
          },
        });
      }),
      nhostGraphQLLink.query('getProjectState', () => {
        getProjectState();
        return HttpResponse.json({
          data: { apps: [projectWithState(projectState)] },
        });
      }),
      nhostGraphQLLink.mutation('UnpauseApplication', () => {
        unpauseApplication();
        projectState = ApplicationStatus.Unpausing;
        return HttpResponse.json({
          data: { updateApp: { id: mockApplication.id } },
        });
      }),
    );

    const user = new TestUserEvent();
    render(<GeneralSettingsPage />);

    const wakeUpButton = await screen.findByRole('button', {
      name: 'Wake up',
    });
    const initialGetProjectRequestCount = getProject.mock.calls.length;
    const initialGetProjectStateRequestCount =
      getProjectState.mock.calls.length;

    await user.click(wakeUpButton);

    await waitFor(() => {
      expect(unpauseApplication).toHaveBeenCalledOnce();
      expect(wakeUpButton).toBeDisabled();
    });

    expect(
      await screen.findByRole('button', { name: 'Pause' }, { timeout: 3000 }),
    ).toBeEnabled();
    expect(getProject).toHaveBeenCalledTimes(initialGetProjectRequestCount);
    expect(getProjectState.mock.calls.length).toBeGreaterThan(
      initialGetProjectStateRequestCount,
    );
  });

  it('re-enables pause after a successful request settles in an errored state', async () => {
    let projectState = ApplicationStatus.Live;
    const pauseApplication = vi.fn();

    server.use(
      nhostGraphQLLink.query('getProjectState', () =>
        HttpResponse.json({
          data: { apps: [projectWithState(projectState)] },
        }),
      ),
      nhostGraphQLLink.mutation('PauseApplication', () => {
        pauseApplication();
        projectState = ApplicationStatus.Errored;
        return HttpResponse.json({
          data: { updateApp: { id: mockApplication.id } },
        });
      }),
    );

    const user = new TestUserEvent();
    render(<GeneralSettingsPage />);

    const pauseButton = await screen.findByRole('button', { name: 'Pause' });
    await user.click(pauseButton);
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(pauseApplication).toHaveBeenCalledOnce();
      expect(pauseButton).toBeDisabled();
    });
    await waitFor(() => expect(pauseButton).toBeEnabled(), { timeout: 3000 });
  });

  it('re-enables wake up after a successful request leaves the project paused', async () => {
    const unpauseApplication = vi.fn();

    server.use(
      nhostGraphQLLink.query('getProjectState', () =>
        HttpResponse.json({
          data: {
            apps: [projectWithState(ApplicationStatus.Paused)],
          },
        }),
      ),
      nhostGraphQLLink.mutation('UnpauseApplication', () => {
        unpauseApplication();
        return HttpResponse.json({
          data: { updateApp: { id: mockApplication.id } },
        });
      }),
    );

    const user = new TestUserEvent();
    render(<GeneralSettingsPage />);

    const wakeUpButton = await screen.findByRole('button', {
      name: 'Wake up',
    });
    await user.click(wakeUpButton);

    await waitFor(() => {
      expect(unpauseApplication).toHaveBeenCalledOnce();
      expect(wakeUpButton).toBeDisabled();
    });
    await waitFor(() => expect(wakeUpButton).toBeEnabled(), {
      timeout: 3000,
    });
  });

  it('keeps pause requests scoped to their project during same-page navigation', async () => {
    const {
      mutationRequests,
      mutationResponses,
      projectAMutationResponse,
      projectBMutationResponse,
      projectBStateResponse,
    } = registerNavigationHandlers('pause', ApplicationStatus.Live);
    const user = new TestUserEvent();
    const view = render(<GeneralSettingsPage />);

    try {
      const projectAPauseButton = await screen.findByRole('button', {
        name: 'Pause',
      });
      await user.click(projectAPauseButton);
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(mutationRequests).toHaveBeenCalledWith(mockApplication.id);
        expect(projectAPauseButton).toBeDisabled();
      });

      mockRouter.query.appSubdomain = otherProject.subdomain;
      view.rerender(<GeneralSettingsPage />);

      const projectBPauseButton = await screen.findByRole('button', {
        name: 'Pause',
      });
      expect(projectBPauseButton).toBeEnabled();

      await user.click(projectBPauseButton);
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(mutationRequests).toHaveBeenNthCalledWith(2, otherProject.id);
        expect(projectBPauseButton).toBeDisabled();
      });

      const projectAErrorMessage = `Project is locked: ${ORIGINAL_PROJECT_NAME}`;
      const initialProjectAErrorCount =
        screen.queryAllByText(projectAErrorMessage).length;
      projectAMutationResponse.resolve();
      await waitFor(() =>
        expect(screen.getAllByText(projectAErrorMessage)).toHaveLength(
          initialProjectAErrorCount + 1,
        ),
      );
      expect(projectBPauseButton).toBeDisabled();

      projectBStateResponse.resolve(
        otherProjectWithState(ApplicationStatus.Live),
      );
      const projectBErrorMessage = `Project is locked: ${OTHER_PROJECT_NAME}`;
      const initialProjectBErrorCount =
        screen.queryAllByText(projectBErrorMessage).length;
      projectBMutationResponse.resolve();
      await waitFor(() =>
        expect(screen.getAllByText(projectBErrorMessage)).toHaveLength(
          initialProjectBErrorCount + 1,
        ),
      );
      await waitFor(() => expect(projectBPauseButton).toBeEnabled());
    } finally {
      mockRouter.query.appSubdomain = mockApplication.subdomain;
      projectAMutationResponse.resolve();
      projectBMutationResponse.resolve();
      projectBStateResponse.resolve(
        otherProjectWithState(ApplicationStatus.Live),
      );
      await waitFor(() => {
        expect(mutationResponses).toHaveBeenCalledTimes(
          mutationRequests.mock.calls.length,
        );
        expect(queryClient.isFetching()).toBe(0);
      });
    }
  });

  it('keeps unpause requests scoped to their project during same-page navigation', async () => {
    const {
      mutationRequests,
      mutationResponses,
      projectAMutationResponse,
      projectBMutationResponse,
      projectBStateResponse,
    } = registerNavigationHandlers('unpause', ApplicationStatus.Paused);
    const user = new TestUserEvent();
    const view = render(<GeneralSettingsPage />);

    try {
      const projectAWakeUpButton = await screen.findByRole('button', {
        name: 'Wake up',
      });
      await user.click(projectAWakeUpButton);

      await waitFor(() => {
        expect(mutationRequests).toHaveBeenCalledWith(mockApplication.id);
        expect(projectAWakeUpButton).toBeDisabled();
      });

      mockRouter.query.appSubdomain = otherProject.subdomain;
      view.rerender(<GeneralSettingsPage />);

      const projectBWakeUpButton = await screen.findByRole('button', {
        name: 'Wake up',
      });
      expect(projectBWakeUpButton).toBeEnabled();

      await user.click(projectBWakeUpButton);

      await waitFor(() => {
        expect(mutationRequests).toHaveBeenNthCalledWith(2, otherProject.id);
        expect(projectBWakeUpButton).toBeDisabled();
      });

      const projectAErrorMessage = `This organization needs attention: ${ORIGINAL_PROJECT_NAME}`;
      const initialProjectAErrorCount =
        screen.queryAllByText(projectAErrorMessage).length;
      projectAMutationResponse.resolve();
      await waitFor(() =>
        expect(screen.getAllByText(projectAErrorMessage)).toHaveLength(
          initialProjectAErrorCount + 1,
        ),
      );
      expect(projectBWakeUpButton).toBeDisabled();

      projectBStateResponse.resolve(
        otherProjectWithState(ApplicationStatus.Paused),
      );
      const projectBErrorMessage = `This organization needs attention: ${OTHER_PROJECT_NAME}`;
      const initialProjectBErrorCount =
        screen.queryAllByText(projectBErrorMessage).length;
      projectBMutationResponse.resolve();
      await waitFor(() =>
        expect(screen.getAllByText(projectBErrorMessage)).toHaveLength(
          initialProjectBErrorCount + 1,
        ),
      );
      await waitFor(() => expect(projectBWakeUpButton).toBeEnabled());
    } finally {
      mockRouter.query.appSubdomain = mockApplication.subdomain;
      projectAMutationResponse.resolve();
      projectBMutationResponse.resolve();
      projectBStateResponse.resolve(
        otherProjectWithState(ApplicationStatus.Paused),
      );
      await waitFor(() => {
        expect(mutationResponses).toHaveBeenCalledTimes(
          mutationRequests.mock.calls.length,
        );
        expect(queryClient.isFetching()).toBe(0);
      });
    }
  });
});
