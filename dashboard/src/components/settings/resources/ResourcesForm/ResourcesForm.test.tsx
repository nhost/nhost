import {
  resourcesAvailableQuery,
  resourcesUnavailableQuery,
} from '@/utils/msw/mocks/graphql/resourceSettingsQuery';
import { render, screen, waitForElementToBeRemoved } from '@/utils/testUtils';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import ResourcesForm from './ResourcesForm';

const server = setupServer(resourcesUnavailableQuery);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('should show a message that the feature must be enabled if no previous data is available', async () => {
  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();
});

test('should show the sliders if the switch is enabled', async () => {
  const user = userEvent.setup();
  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.getByText(/enable this feature/i)).toBeInTheDocument();

  await user.click(screen.getByRole('checkbox'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
});

test('should not show the message if there is data available', async () => {
  server.use(resourcesAvailableQuery);

  render(<ResourcesForm />);

  await waitForElementToBeRemoved(() => screen.getByRole('progressbar'));

  expect(screen.queryByText(/enable this feature/i)).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(9);
});
