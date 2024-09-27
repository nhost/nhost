import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import {
  getProPlanOnlyQuery,
  getWorkspaceAndProjectQuery,
} from '@/tests/msw/mocks/graphql/plansQuery';
import {
  resourcesAvailableQuery,
  resourcesUnavailableQuery,
  resourcesUpdatedQuery,
} from '@/tests/msw/mocks/graphql/resourceSettingsQuery';
import updateConfigMutation from '@/tests/msw/mocks/graphql/updateConfigMutation';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@/tests/testUtils';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { expect, test, vi } from 'vitest';
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
  getProPlanOnlyQuery,
  getWorkspaceAndProjectQuery,
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

// Note: Workaround based on https://github.com/testing-library/user-event/issues/871#issuecomment-1059317998
function changeSliderValue(slider: HTMLElement, value: number) {
  fireEvent.input(slider, { target: { value } });
  fireEvent.change(slider, { target: { value } });
}

test('should show an empty state message that the feature must be enabled if no data is available', async () => {
  server.use(resourcesUnavailableQuery);

  render(<ResourcesForm />);

  expect(await screen.findByText(/enable this feature/i)).toBeInTheDocument();
});

test('should show the sliders if the switch is enabled', async () => {
  server.use(resourcesUnavailableQuery);
  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(await screen.findByText(/enable this feature/i)).toBeInTheDocument();

  await user.click(screen.getByRole('checkbox'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
});

test('should not show an empty state message if there is data available', async () => {
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 8/i);
  expect(screen.getByText(/^memory:/i)).toHaveTextContent(/memory: 16384 mib/i);
});

test('should show a warning message if not all the resources are allocated', async () => {
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    9 * RESOURCE_VCPU_MULTIPLIER,
  );

  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 9/i);
  expect(screen.getByText(/^memory:/i)).toHaveTextContent(/memory: 18432 mib/i);

  expect(
    screen.getByText(/you have 1 vcpus and 2048 mib of memory unused./i),
  ).toBeInTheDocument();
});

test('should update the price when the top slider is changed', async () => {
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.queryByText(/\$200\.00\/mo/i)).not.toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    9 * RESOURCE_VCPU_MULTIPLIER,
  );

  expect(screen.getByText(/\$425\.00\/mo/i)).toBeInTheDocument();
  // we display the final price in two places
  expect(screen.getAllByText(/\$475\.00\/mo/i)).toHaveLength(2);
});

test('should show a validation error when the form is submitted when not everything is allocated', async () => {
  const user = userEvent.setup();
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    9 * RESOURCE_VCPU_MULTIPLIER,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(
    screen.getByText(/you have 1 vcpus and 2048 mib of memory unused./i),
  ).toBeInTheDocument();

  expect(screen.getByText(/invalid configuration/i)).toBeInTheDocument();
});

test('should show a confirmation dialog when the form is submitted', async () => {
  server.use(updateConfigMutation);

  const user = userEvent.setup();
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    9 * RESOURCE_VCPU_MULTIPLIER,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /database vcpu/i }),
    2 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql vcpu/i }),
    2.5 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /auth vcpu/i }),
    1.5 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /storage vcpu/i }),
    3 * RESOURCE_VCPU_MULTIPLIER,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /database memory/i }),
    4.75 * RESOURCE_MEMORY_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql memory/i }),
    4.25 * RESOURCE_MEMORY_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /auth memory/i }),
    4 * RESOURCE_MEMORY_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /storage memory/i }),
    5 * RESOURCE_MEMORY_MULTIPLIER,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByRole('heading', {
      name: /confirm dedicated resources/i,
    }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByText(/postgresql database/i)
      .parentElement,
  ).toHaveTextContent(/2 vcpu \+ 4864 mib/i);
  expect(
    within(screen.getByRole('dialog')).getByText(/hasura graphql/i)
      .parentElement,
  ).toHaveTextContent(/2.5 vcpu \+ 4352 mib/i);
  expect(
    within(screen.getByRole('dialog')).getByText(/auth/i).parentElement,
  ).toHaveTextContent(/1.5 vcpu \+ 4096 mib/i);
  expect(
    within(screen.getByRole('dialog')).getByText(/storage/i).parentElement,
  ).toHaveTextContent(/3 vcpu \+ 5120 mib/i);
  expect(
    within(screen.getByRole('dialog')).getByText(/\$475\.00\/mo/i),
  ).toBeInTheDocument();

  // we need to mock the query again because the mutation updated the resources
  // and we need to return the updated values
  server.use(resourcesUpdatedQuery);

  await user.click(screen.getByRole('button', { name: /confirm/i }));

  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

  expect(
    await screen.findByText(/resources have been updated successfully./i),
  ).toBeInTheDocument();

  expect(
    screen.getByRole('slider', { name: /total available vcpu/i }),
  ).toHaveValue((9 * RESOURCE_VCPU_MULTIPLIER).toString());
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
});

test('should display a red button when custom resources are disabled', async () => {
  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  await user.click(screen.getAllByRole('checkbox')[0]);

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();
  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$25\.00\/mo/i,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();

  expect(
    screen.getByRole('heading', { name: /disable dedicated resources/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /confirm/i })).toHaveStyle({
    'background-color': '#f13154',
  });
});

test('should hide the pricing information when custom resource allocation is disabled', async () => {
  server.use(updateConfigMutation);

  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  await user.click(screen.getAllByRole('checkbox')[0]);

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();

  server.use(resourcesUnavailableQuery);

  await user.click(screen.getByRole('button', { name: /confirm/i }));

  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

  expect(screen.queryByText(/approximate cost:/i)).not.toBeInTheDocument();
});

test('should show a warning message when resources are overallocated', async () => {
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    7 * RESOURCE_VCPU_MULTIPLIER,
  );

  expect(
    screen.getByText(
      /^you have 1 vCPUs and 2048 mib of memory overallocated\. reduce it before saving or increase the total amount\./i,
    ),
  ).toBeInTheDocument();
});

test('should change pricing based on selected replicas', async () => {
  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$425\.00\/mo/i,
  );

  const hasuraReplicasInput = screen.getAllByPlaceholderText('Replicas')[0];

  await user.click(hasuraReplicasInput);
  await user.clear(hasuraReplicasInput);
  await user.type(hasuraReplicasInput, '2');

  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  await waitFor(() =>
    expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
      /approximate cost: \$525\.00\/mo/i,
    ),
  );

  await user.click(hasuraReplicasInput);
  await user.clear(hasuraReplicasInput);
  await user.type(hasuraReplicasInput, '1');

  await waitFor(() => {
    expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
      /approximate cost: \$425\.00\/mo/i,
    );
  });
});

test('should validate if vCPU and Memory match the 1:2 ratio if more than 1 replica is selected', async () => {
  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    20 * RESOURCE_VCPU_MULTIPLIER,
  );

  const storageReplicasInput = screen.getAllByPlaceholderText('Replicas')[2];
  await user.click(storageReplicasInput);
  await user.clear(storageReplicasInput);
  await user.type(storageReplicasInput, '2');

  changeSliderValue(
    screen.getByRole('slider', { name: /storage vcpu/i }),
    1 * RESOURCE_VCPU_MULTIPLIER,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /storage memory/i }),
    6 * RESOURCE_MEMORY_MULTIPLIER,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText(/invalid configuration/i)).toBeInTheDocument();
  expect(
    screen.getByText(
      /please check the form for errors and the allocation for each service and try again\./i,
    ),
  ).toBeInTheDocument();

  await waitFor(() => {
    const validationErrorMessage = screen.getByText(
      /vCPU and Memory for this service must follow a 1:2 ratio when more than one replica is selected or when the autoscaler is activated\./i,
    );
    expect(validationErrorMessage).toBeInTheDocument();
    expect(validationErrorMessage).toHaveStyle({ color: '#f13154' });
  });
});

test('should take replicas into account when confirming the resources', async () => {
  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  changeSliderValue(
    screen.getByRole('slider', {
      name: /total available vcpu/i,
    }),
    8.5 * RESOURCE_VCPU_MULTIPLIER,
  );

  // setting up database
  changeSliderValue(
    screen.getByRole('slider', { name: /database vcpu/i }),
    2 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /database memory/i }),
    4 * RESOURCE_MEMORY_MULTIPLIER,
  );

  const hasuraReplicasInput = screen.getAllByPlaceholderText('Replicas')[0];
  await user.click(hasuraReplicasInput);
  await user.clear(hasuraReplicasInput);
  await user.type(hasuraReplicasInput, '3');

  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql vcpu/i }),
    2.5 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql memory/i }),
    5 * RESOURCE_MEMORY_MULTIPLIER,
  );

  const authReplicasInput = screen.getAllByPlaceholderText('Replicas')[1];
  // setting up auth
  await user.click(authReplicasInput);
  await user.clear(authReplicasInput);
  await user.type(authReplicasInput, '2');

  changeSliderValue(
    screen.getByRole('slider', { name: /auth vcpu/i }),
    1.5 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /auth memory/i }),
    3 * RESOURCE_MEMORY_MULTIPLIER,
  );

  const storageReplicasInput = screen.getAllByPlaceholderText('Replicas')[2];
  // setting up storage
  await user.click(storageReplicasInput);
  await user.clear(storageReplicasInput);
  await user.type(storageReplicasInput, '4');

  changeSliderValue(
    screen.getByRole('slider', { name: /storage vcpu/i }),
    2.5 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /storage memory/i }),
    5 * RESOURCE_MEMORY_MULTIPLIER,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();

  const dialog = screen.getByRole('dialog');

  expect(
    within(dialog).getByText(/postgresql database/i).parentElement,
  ).toHaveTextContent(/2 vcpu \+ 4096 mib/i);

  expect(
    within(dialog).getByText(/hasura graphql/i).parentElement,
  ).toHaveTextContent(/2\.5 vcpu \+ 5120 mib \(3 replicas\)/i);

  expect(within(dialog).getByText(/auth/i).parentElement).toHaveTextContent(
    /1\.5 vcpu \+ 3072 mib \(2 replicas\)/i,
  );

  expect(within(dialog).getByText(/storage/i).parentElement).toHaveTextContent(
    /2\.5 vcpu \+ 5120 mib \(4 replicas\)/i,
  );

  // total must contain the sum of all resources when replicas are taken into
  // account
  expect(within(dialog).getByText(/total/i).parentElement).toHaveTextContent(
    /22\.5 vcpu \+ 46080 mib/i,
  );

  expect(within(dialog).getByText(/\$0.0270\/min/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/\$1150\.00\/mo/i)).toBeInTheDocument();
});
