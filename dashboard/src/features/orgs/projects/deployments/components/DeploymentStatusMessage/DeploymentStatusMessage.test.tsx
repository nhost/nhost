import { test, vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import {
  type PipelineRunRowFragment,
  PipelineRunStatus_Enum,
} from '@/utils/__generated__/graphql';
import DeploymentStatusMessage from './DeploymentStatusMessage';

const defaultPipelineRun: Partial<PipelineRunRowFragment> = {
  id: 'de305d54-75b4-431b-adb2-eb6b9e546013',
  startedAt: '2023-02-24T12:00:00.000Z',
  endedAt: null,
  status: PipelineRunStatus_Enum.Pending,
  input: {
    name: 'nhost-backend-build',
    app_id: 'test-app-id',
    commit_sha: '1234567890',
    commit_message: 'Update README.md',
    commit_user_name: 'john.doe',
    commit_user_avatar_url: 'https://example.com/avatar.png',
  },
};

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

test('should render the avatar of the user who deployed the application', () => {
  render(<DeploymentStatusMessage pipelineRun={defaultPipelineRun} />);

  expect(
    screen.getByRole('img', {
      name: 'Avatar of john.doe',
    }),
  ).toHaveAttribute('src', 'https://example.com/avatar.png');
});

test('should render "updated just now" when the deployment is in progress and has not ended', () => {
  render(<DeploymentStatusMessage pipelineRun={defaultPipelineRun} />);

  expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
});

test('should render "updated just now" when the deployment\'s status is succeeded, but it doesn\'t have an end date for some reason', () => {
  render(
    <DeploymentStatusMessage
      pipelineRun={{
        ...defaultPipelineRun,
        status: PipelineRunStatus_Enum.Succeeded,
        endedAt: null,
      }}
    />,
  );

  expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
});

test('should render "deployed 1 day ago" when the deployment has ended', () => {
  vi.setSystemTime(new Date('2023-02-25T12:25:00.000Z'));

  render(
    <DeploymentStatusMessage
      pipelineRun={{
        ...defaultPipelineRun,
        status: PipelineRunStatus_Enum.Succeeded,
        endedAt: '2023-02-24T12:15:00.000Z',
      }}
    />,
  );

  expect(screen.getByText(/deployed 1 day ago/i)).toBeInTheDocument();
});
