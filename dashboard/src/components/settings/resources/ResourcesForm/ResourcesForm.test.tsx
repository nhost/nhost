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
import ResourcesForm from './ResourcesForm';

const server = setupServer(resourcesAvailableQuery);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('should show a message that the feature must be enabled if no previous data is available', async () => {
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

test('should not show the message if there is data available', async () => {
  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
  expect(screen.getByRole('spinbutton', { name: /^vcpus:$/i })).toHaveValue(8);
  expect(screen.getByRole('spinbutton', { name: /^memory:$/i })).toHaveValue(
    16,
  );
});

test('should show a warning message if not all the resources are allocated', async () => {
  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  // Note: Workaround based on https://github.com/testing-library/user-event/issues/871#issuecomment-1059317998
  fireEvent.change(
    screen.getByRole('slider', {
      name: /total available vcpu slider/i,
    }),
    { target: { value: 9 } },
  );

  expect(screen.getByRole('spinbutton', { name: /^vcpus:$/i })).toHaveValue(9);
  expect(screen.getByRole('spinbutton', { name: /^memory:$/i })).toHaveValue(
    18,
  );
  expect(
    screen.getByText(/you now have 1 vcpus and 2 gib of memory unused./i),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByRole('spinbutton', { name: /^vcpus:$/i }), {
    target: { value: 8 },
  });

  expect(screen.getByRole('spinbutton', { name: /^vcpus:$/i })).toHaveValue(8);
  expect(screen.getByRole('spinbutton', { name: /^memory:$/i })).toHaveValue(
    16,
  );
  expect(
    screen.getByRole('slider', { name: /total available vcpu slider/i }),
  ).toHaveValue('8');
});
