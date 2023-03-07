import { UserDataProvider } from '@/context/workspace1-context';
import { mockApplication, mockWorkspace } from '@/tests/mocks';
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@/tests/testUtils';
import {
  resourcesAvailableQuery,
  resourcesUnavailableQuery,
} from '@/utils/msw/mocks/graphql/resourceSettingsQuery';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import type { ReactElement } from 'react';
import { test, vi } from 'vitest';
import ResourcesForm from './ResourcesForm';

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue({
    basePath: '',
    pathname: '/test-workspace/test-application',
    route: '/[workspaceSlug]/[appSlug]',
    asPath: '/test-workspace/test-application',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    query: {
      workspaceSlug: 'test-workspace',
      appSlug: 'test-application',
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
  }),
}));

const server = setupServer(resourcesAvailableQuery);

const renderWithProProject = (ui: ReactElement) =>
  render(
    <UserDataProvider
      initialWorkspaces={[
        {
          ...mockWorkspace,
          applications: [
            {
              ...mockApplication,
              plan: { id: '2', name: 'Pro', isFree: false, price: 25 },
            },
          ],
        },
      ]}
    >
      {ui}
    </UserDataProvider>,
  );

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function changeSliderValue(slider: HTMLElement, value: number) {
  // Note: Workaround based on https://github.com/testing-library/user-event/issues/871#issuecomment-1059317998
  fireEvent.input(slider, { target: { value } });
  fireEvent.change(slider, { target: { value } });
}

test('should show an empty state message that the feature must be enabled if no data is available', async () => {
  server.use(resourcesUnavailableQuery);

  renderWithProProject(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();
});

test('should show the sliders if the switch is enabled', async () => {
  server.use(resourcesUnavailableQuery);
  const user = userEvent.setup();

  renderWithProProject(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();

  await user.click(screen.getByRole('checkbox'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
});

test('should not show an empty state message if there is data available', async () => {
  renderWithProProject(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 8/i);
  expect(screen.getByText(/^memory:/i)).toHaveTextContent(/memory: 16 gib/i);
});

test('should show a warning message if not all the resources are allocated', async () => {
  renderWithProProject(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu slider/i,
    }),
    9,
  );

  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 9/i);
  expect(screen.getByText(/^memory:/i)).toHaveTextContent(/memory: 18 gib/i);

  expect(
    screen.getByText(/you now have 1 vcpus and 2 gib of memory unused./i),
  ).toBeInTheDocument();
});

test('should update the price when the top slider is changed', async () => {
  renderWithProProject(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.queryByText(/\$200.00\/mo/i)).not.toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu slider/i,
    }),
    9,
  );

  expect(screen.getByText(/\$425.00\/mo/i)).toBeInTheDocument();
  // we display the final price in two places
  expect(screen.getAllByText(/\$475.00\/mo/i)).toHaveLength(2);
});
