import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { expect, test, vi } from 'vitest';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
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

test('toggling the master switch on then off leaves Save disabled', async () => {
  server.use(resourcesUnavailableQuery);
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  expect(await screen.findByText(/enable this feature/i)).toBeInTheDocument();

  const checkbox = screen.getByRole('checkbox');
  await user.click(checkbox);

  await screen.findByRole('button', { name: /^starter/i });

  const saveWhenEnabled = screen.getByRole('button', {
    name: /^save$/i,
  }) as HTMLButtonElement;
  expect(saveWhenEnabled.disabled).toBe(false);

  await user.click(checkbox);

  await screen.findByText(/enable this feature/i);
  const saveWhenDisabled = screen.getByRole('button', {
    name: /^save$/i,
  }) as HTMLButtonElement;
  expect(saveWhenDisabled.disabled).toBe(true);
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

  await user.click(screen.getByRole('button', { name: /^save$/i }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByRole('heading', {
      name: /confirm dedicated resources/i,
    }),
  ).toBeInTheDocument();

  // Billable after one +CPU on database: 2.25 + 2 + 2 + 2 = 8.25 vCPU
  // memory: 4608 + 4096*3 = 16896 MiB. Cost: 8.25 * $50 = $412.50/mo,
  // 8.25 * $0.0012 = $0.0099/min.
  expect(within(dialog).getByText(/\$0\.0099\/min/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/\$412\.50\/mo/i)).toBeInTheDocument();

  expect(
    within(dialog).getByText(/postgresql database/i).parentElement,
  ).toHaveTextContent(/2\.25 vCPU \+ 4608 MiB/i);
  expect(
    within(dialog).getByText(/hasura graphql/i).parentElement,
  ).toHaveTextContent(/2 vCPU \+ 4096 MiB/i);
  expect(within(dialog).getByText(/^Total$/i).parentElement).toHaveTextContent(
    /8\.25 vCPU \+ 16896 MiB/i,
  );

  server.use(resourcesUpdatedQuery);

  await user.click(screen.getByRole('button', { name: /^confirm$/i }));

  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

  expect(
    await screen.findByText(/resources have been updated successfully./i),
  ).toBeInTheDocument();
});

test('replicas are reflected in the dialog rows and recalculated cost', async () => {
  const user = new TestUserEvent();
  server.use(updateConfigMutation);
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  // Footer CostSummary starts at 8 vCPU * $50 = $400.00/mo.
  expect(screen.getByText(/^\$400\.00\/mo$/i)).toBeInTheDocument();

  await user.click(
    screen.getByRole('button', { name: /increase hasura graphql replicas/i }),
  );

  // Hasura now has 2 replicas. Billable CPU: 2 + 2*2 + 2 + 2 = 10 vCPU →
  // $500.00/mo.
  await waitFor(() => {
    expect(screen.getByText(/\$500\.00\/mo/i)).toBeInTheDocument();
  });

  await user.click(screen.getByRole('button', { name: /^save$/i }));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/\$0\.0120\/min/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/\$500\.00\/mo/i)).toBeInTheDocument();
  expect(
    within(dialog).getByText(/hasura graphql/i).parentElement,
  ).toHaveTextContent(/2 vCPU \+ 4096 MiB \(2 replicas\)/i);
  expect(within(dialog).getByText(/^Total$/i).parentElement).toHaveTextContent(
    /10 vCPU \+ 20480 MiB/i,
  );
});

test('disabling resources surfaces the destructive confirm dialog', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });

  await user.click(screen.getByRole('checkbox'));

  await user.click(screen.getByRole('button', { name: /^save$/i }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByRole('heading', {
      name: /disable dedicated resources/i,
    }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: /^confirm$/i }),
  ).toHaveClass('bg-destructive');
});

function pickPresetButton(label: string) {
  const btn = screen.getAllByRole('button').find((b: HTMLElement) => {
    const text = b.textContent ?? '';
    if (label === 'Performance') {
      return (
        text.startsWith('Performance') && !text.startsWith('Performance + HA')
      );
    }
    return text.startsWith(label);
  });
  if (!btn) {
    throw new Error(`No preset button matching "${label}"`);
  }
  return btn;
}

test('Performance + HA enables Save and is detected as the active preset', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);
  await screen.findByRole('tab', { name: /advanced/i });

  await user.click(pickPresetButton('Performance + HA'));

  const saveBtn = screen.getByRole('button', {
    name: /^save$/i,
  }) as HTMLButtonElement;
  expect(saveBtn.disabled).toBe(false);

  const activePresetButtons = screen
    .getAllByRole('button')
    .filter((b: HTMLElement) => b.getAttribute('aria-pressed') === 'true');
  expect(activePresetButtons).toHaveLength(1);
  expect(activePresetButtons[0].textContent).toMatch(/^Performance \+ HA/);
});

const resourcesMatchingPerformancePreset = nhostGraphQLLink.query(
  'GetResources',
  () =>
    HttpResponse.json({
      data: {
        config: {
          __typename: 'ConfigConfig',
          postgres: {
            resources: {
              compute: { cpu: 3000, memory: 6144 },
              enablePublicAccess: null,
              storage: { capacity: 1 },
              autoscaler: null,
              networking: null,
              replicas: 1,
            },
          },
          hasura: {
            resources: {
              compute: { cpu: 500, memory: 1024 },
              autoscaler: { maxReplicas: 10 },
              networking: null,
              replicas: 1,
            },
          },
          auth: {
            resources: {
              compute: { cpu: 250, memory: 512 },
              autoscaler: { maxReplicas: 10 },
              networking: null,
              replicas: 1,
            },
          },
          storage: {
            resources: {
              compute: { cpu: 250, memory: 512 },
              autoscaler: { maxReplicas: 10 },
              networking: null,
              replicas: 1,
            },
          },
        },
      },
    }),
);

test('re-selecting the originally loaded preset disables Save again', async () => {
  server.use(resourcesMatchingPerformancePreset);

  const user = new TestUserEvent();
  render(<ResourcesForm />);
  await screen.findByRole('tab', { name: /advanced/i });

  const saveBtn = screen.getByRole('button', {
    name: /^save$/i,
  }) as HTMLButtonElement;
  expect(saveBtn.disabled).toBe(true);

  await user.click(pickPresetButton('Standard'));
  expect(saveBtn.disabled).toBe(false);

  await user.click(pickPresetButton('Performance'));
  expect(saveBtn.disabled).toBe(true);
});

test('reverting an Advanced edit via the originally loaded preset disables Save', async () => {
  server.use(resourcesMatchingPerformancePreset);

  const user = new TestUserEvent();
  render(<ResourcesForm />);
  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  const saveBtn = screen.getByRole('button', {
    name: /^save$/i,
  }) as HTMLButtonElement;
  expect(saveBtn.disabled).toBe(true);

  await user.click(
    screen.getByRole('button', { name: /increase postgresql database vcpu/i }),
  );
  expect(saveBtn.disabled).toBe(false);

  await user.click(screen.getByRole('tab', { name: /overview/i }));
  await user.click(pickPresetButton('Performance'));

  expect(saveBtn.disabled).toBe(true);
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

test('ratio mismatch disables Save with a reason, then re-enables once fixed', async () => {
  const user = new TestUserEvent();
  render(<ResourcesForm />);

  await screen.findByRole('tab', { name: /advanced/i });
  await switchToAdvancedTab(user);

  const saveBtn = screen.getByRole('button', {
    name: /^save$/i,
  }) as HTMLButtonElement;

  const lockSwitch = screen.getByRole('switch', {
    name: /lock 1:2 ratio for auth/i,
  });
  await user.click(lockSwitch);
  await user.click(
    screen.getByRole('button', { name: /decrease auth memory/i }),
  );

  await waitFor(() => {
    expect(
      screen.getByText(/add .* of memory to reach the 1:2 ratio/i),
    ).toBeInTheDocument();
  });
  expect(saveBtn.disabled).toBe(true);

  await user.click(
    screen.getByRole('button', { name: /increase auth memory/i }),
  );

  await waitFor(() => {
    expect(
      screen.queryByText(/of memory to reach the 1:2 ratio/i),
    ).not.toBeInTheDocument();
  });
  expect(saveBtn.disabled).toBe(false);
});
