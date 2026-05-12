import { setupServer } from 'msw/node';
import { expect, test, vi } from 'vitest';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import { getProPlanOnlyQuery } from '@/tests/msw/mocks/graphql/plansQuery';
import {
  resourcesAvailableQuery,
  resourcesUnavailableQuery,
  resourcesUpdatedQuery,
} from '@/tests/msw/mocks/graphql/resourceSettingsQuery';
import updateConfigMutation from '@/tests/msw/mocks/graphql/updateConfigMutation';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@/tests/testUtils';
import ResourcesForm from './ResourcesForm';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue(mockRouter),
}));

const server = setupServer(
  tokenQuery,
  resourcesAvailableQuery,
  getProjectQuery,
  getProPlanOnlyQuery,
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

const getDatabaseCPUValue = () =>
  screen.getByRole('status', { name: /^PostgreSQL Database vCPU$/i });
const getHasuraCPUValue = () =>
  screen.getByRole('status', { name: /^Hasura GraphQL vCPU$/i });
const getAuthCPUValue = () =>
  screen.getByRole('status', { name: /^Auth vCPU$/i });
const getStorageCPUValue = () =>
  screen.getByRole('status', { name: /^Storage vCPU$/i });
const getAuthMemoryValue = () =>
  screen.getByRole('status', { name: /^Auth Memory$/i });

const switchToAdvancedTab = async (user: TestUserEvent) => {
  await user.click(screen.getByRole('tab', { name: /advanced/i }));
  await screen.findByRole('button', {
    name: /increase postgresql database vcpu/i,
  });
};

test('shows an empty state when no resources are configured', async () => {
  server.use(resourcesUnavailableQuery);
  render(<ResourcesForm />);

  expect(await screen.findByText(/enable this feature/i)).toBeInTheDocument();
});

test('enabling the master switch reveals the Overview tab with presets', async () => {
  server.use(resourcesUnavailableQuery);
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  expect(await screen.findByText(/enable this feature/i)).toBeInTheDocument();

  await user.click(screen.getByRole('checkbox'));

  await waitFor(() => {
    expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  });

  expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /advanced/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^starter/i })).toBeInTheDocument();
});

test('Advanced tab renders per-service steppers with initial values', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  expect(getDatabaseCPUValue()).toHaveTextContent(/2\.00 vCPU/i);
  expect(getHasuraCPUValue()).toHaveTextContent(/2\.00 vCPU/i);
});

test('incrementing CPU auto-derives memory in default mode', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  const increaseCPU = screen.getByRole('button', {
    name: /increase auth vcpu/i,
  });
  await user.click(increaseCPU);

  await waitFor(() => {
    expect(getAuthCPUValue()).toHaveTextContent(/2\.25 vCPU/i);
  });

  await waitFor(() => {
    expect(getAuthMemoryValue()).toHaveTextContent(/4\.50 GiB/i);
  });
});

test('picking a preset fills service values', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });

  await user.click(screen.getByRole('button', { name: /^starter/i }));

  await switchToAdvancedTab(user);

  await waitFor(() => {
    expect(getDatabaseCPUValue()).toHaveTextContent(/0\.25 vCPU/i);
  });

  expect(getHasuraCPUValue()).toHaveTextContent(/0\.25 vCPU/i);
  expect(getAuthCPUValue()).toHaveTextContent(/0\.25 vCPU/i);
  expect(getStorageCPUValue()).toHaveTextContent(/0\.25 vCPU/i);
});

test('opens the confirmation dialog when saving valid changes', async () => {
  const user = new TestUserEvent();
  server.use(updateConfigMutation);
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  await user.click(
    screen.getByRole('button', { name: /increase postgresql database vcpu/i }),
  );

  await user.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByRole('heading', {
      name: /confirm dedicated resources/i,
    }),
  ).toBeInTheDocument();

  server.use(resourcesUpdatedQuery);

  await user.click(screen.getByRole('button', { name: /^confirm$/i }));

  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

  expect(
    await screen.findByText(/resources have been updated successfully./i),
  ).toBeInTheDocument();
});

test('disabling resources surfaces the destructive confirm dialog', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });

  await user.click(screen.getByRole('checkbox'));

  await user.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByRole('heading', {
      name: /disable dedicated resources/i,
    }),
  ).toBeInTheDocument();
});

test('unlocking a service in Advanced lets memory drift and surfaces the ratio banner', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  const lockSwitch = screen.getByRole('switch', {
    name: /lock 1:2 ratio for auth/i,
  });
  await user.click(lockSwitch);

  await user.click(
    screen.getByRole('button', { name: /decrease auth memory/i }),
  );

  await waitFor(() => {
    expect(
      screen.getAllByText(/of memory (unallocated|over the 1:2 ratio)/i)[0],
    ).toBeInTheDocument();
  });
});
