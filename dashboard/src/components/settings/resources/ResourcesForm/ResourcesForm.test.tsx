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
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@/tests/testUtils';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/CONSTANTS';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { test, vi } from 'vitest';
import ResourcesForm from './ResourcesForm';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue(mockRouter),
}));

const server = setupServer(
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
  expect(screen.getAllByRole('slider')).toHaveLength(12);
});

test('should not show an empty state message if there is data available', async () => {
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(12);
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
    screen.getByText(/you now have 1 vcpus and 2048 mib of memory unused./i),
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
    screen.getAllByText(/you now have 1 vcpus and 2048 mib of memory unused./i),
  ).toHaveLength(2);
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
    2.25 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql vcpu/i }),
    2.25 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /auth vcpu/i }),
    2.25 * RESOURCE_VCPU_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /storage vcpu/i }),
    2.25 * RESOURCE_VCPU_MULTIPLIER,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /database memory/i }),
    4.5 * RESOURCE_MEMORY_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql memory/i }),
    4.5 * RESOURCE_MEMORY_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /auth memory/i }),
    4.5 * RESOURCE_MEMORY_MULTIPLIER,
  );
  changeSliderValue(
    screen.getByRole('slider', { name: /storage memory/i }),
    4.5 * RESOURCE_MEMORY_MULTIPLIER,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByRole('heading', {
      name: /confirm dedicated resources/i,
    }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByText(
      /9 vcpus \+ 18432 mib of memory/i,
      { exact: true },
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('dialog')).getByText(/\$475\.00\/mo/i, {
      exact: true,
    }),
  ).toBeInTheDocument();

  // we need to mock the query again because the mutation updated the resources
  // and we need to return the updated values
  server.use(resourcesUpdatedQuery);

  await user.click(screen.getByRole('button', { name: /confirm/i }));

  await waitForElementToBeRemoved(() => screen.getByRole('dialog'));

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

  await user.click(screen.getByRole('checkbox'));

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

  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();

  server.use(resourcesUnavailableQuery);

  await user.click(screen.getByRole('button', { name: /confirm/i }));

  await waitForElementToBeRemoved(() => screen.getByRole('dialog'));

  expect(screen.queryByText(/approximate cost:/i)).not.toBeInTheDocument();
});

test('should not be able to lower the total available resources below the allocated resources', async () => {
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

  expect(screen.getByText(/^vcpus:/i)).toHaveTextContent(/vcpus: 8/i);
});

test('should change pricing based on selected replicas', async () => {
  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$425\.00\/mo/i,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql replicas/i }),
    2,
  );

  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$525\.00\/mo/i,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql replicas/i }),
    1,
  );

  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$425\.00\/mo/i,
  );
});

test('should change pricing in the modal based on selected replicas', async () => {
  const user = userEvent.setup();

  render(<ResourcesForm />);

  expect(
    await screen.findByRole('slider', { name: /total available vcpu/i }),
  ).toBeInTheDocument();

  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$425\.00\/mo/i,
  );

  changeSliderValue(
    screen.getByRole('slider', { name: /hasura graphql replicas/i }),
    2,
  );

  expect(screen.getByText(/approximate cost:/i)).toHaveTextContent(
    /approximate cost: \$525\.00\/mo/i,
  );

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();

  // vCPUs and Memory should not change
  expect(
    within(screen.getByRole('dialog')).getByText(
      /^8 vcpus \+ 16384 mib of memory$/i,
    ),
  ).toBeInTheDocument();

  // The price should change
  expect(
    within(screen.getByRole('dialog')).getByText(/^\$525\.00\/mo$/i),
  ).toBeInTheDocument();
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

  changeSliderValue(
    screen.getByRole('slider', { name: /storage replicas/i }),
    2,
  );

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
      /please check the allocation for each service and try again\./i,
    ),
  ).toBeInTheDocument();

  const validationErrorMessage = screen.getByLabelText(
    /vCPU and Memory must match the 1:2 ratio if more than one replica is selected\./i,
  );

  expect(validationErrorMessage).toBeInTheDocument();
  expect(validationErrorMessage).toHaveStyle({ color: '#f13154' });
});
