import {
  resourcesAvailableQuery,
  resourcesUnavailableQuery,
} from '@/utils/msw/mocks/graphql/resourceSettingsQuery';
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@/utils/testUtils';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
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

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('should show an empty state message that the feature must be enabled if no data is available', async () => {
  server.use(resourcesUnavailableQuery);

  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();
});

test('should show the sliders if the switch is enabled', async () => {
  server.use(resourcesUnavailableQuery);
  const user = userEvent.setup();

  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();

  await user.click(screen.getByRole('checkbox'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
});

test('should not show an empty state message if there is data available', async () => {
  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 8/i);
  expect(screen.getByText(/^memory:/i)).toHaveTextContent(/memory: 16 gib/i);
});

test('should show a warning message if not all the resources are allocated', async () => {
  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  const slider = screen.getByRole('slider', {
    name: /total available vcpu slider/i,
  });

  // Note: Workaround based on https://github.com/testing-library/user-event/issues/871#issuecomment-1059317998
  fireEvent.input(slider, { target: { value: 9 } });
  fireEvent.change(slider, { target: { value: 9 } });

  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 9/i);
  expect(screen.getByText(/^memory:/i)).toHaveTextContent(/memory: 18 gib/i);

  expect(
    screen.getByText(/you now have 1 vcpus and 2 gib of memory unused./i),
  ).toBeInTheDocument();
});
