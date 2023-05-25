import { render, screen } from '@/tests/testUtils';
import type { Deployment } from '@/types/application';
import { test, vi } from 'vitest';
import DeploymentStatusMessage from './DeploymentStatusMessage';

const defaultDeployment: Deployment = {
  id: 'de305d54-75b4-431b-adb2-eb6b9e546013',
  commitUserName: 'john.doe',
  commitUserAvatarUrl: 'https://example.com/avatar.png',
  deploymentStartedAt: '2023-02-24T12:00:00.000Z',
  deploymentEndedAt: null,
  deploymentStatus: 'SCHEDULED',
  commitSHA: '1234567890',
  commitMessage: 'Update README.md',
};

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

test('should render the avatar of the user who deployed the application', () => {
  render(
    <DeploymentStatusMessage
      deployment={defaultDeployment}
      appCreatedAt="2023-02-24"
    />,
  );

  expect(
    screen.getByRole('img', {
      name: `Avatar of ${defaultDeployment.commitUserName}`,
    }),
  ).toHaveAttribute(
    'style',
    `background-image: url(${defaultDeployment.commitUserAvatarUrl});`,
  );
});

test('should render "updated just now" when the deployment is in progress and has not ended', () => {
  render(
    <DeploymentStatusMessage
      deployment={defaultDeployment}
      appCreatedAt="2023-02-24"
    />,
  );

  expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
});

test('should render "updated just now" when the deployment\'s status is DEPLOYED, but it doesn\'t have an end date for some reason', () => {
  render(
    <DeploymentStatusMessage
      deployment={{
        ...defaultDeployment,
        deploymentStatus: 'DEPLOYED',
        deploymentEndedAt: null,
      }}
      appCreatedAt="2023-02-24"
    />,
  );

  expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
});

test('should render "deployed 1 day ago" when the deployment has ended', () => {
  vi.setSystemTime(new Date('2023-02-25T12:25:00.000Z'));

  render(
    <DeploymentStatusMessage
      deployment={{
        ...defaultDeployment,
        deploymentStatus: 'DEPLOYED',
        deploymentEndedAt: '2023-02-24T12:15:00.000Z',
      }}
      appCreatedAt="2023-02-24"
    />,
  );

  expect(screen.getByText(/deployed 1 day ago/i)).toBeInTheDocument();
});

test('should render "created 1 day ago" if the application does not have a deployment', () => {
  vi.setSystemTime(new Date('2023-02-25T12:25:00.000Z'));

  render(
    <DeploymentStatusMessage deployment={null} appCreatedAt="2023-02-24" />,
  );

  expect(screen.getByText(/created 1 day ago/i)).toBeInTheDocument();
});
