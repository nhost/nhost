import { PipelineRunStatus_Enum } from '@/generated/graphql';
import { render, screen } from '@/tests/testUtils';
import ProjectLastDeployment from './ProjectLastDeployment';

const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function run(status: PipelineRunStatus_Enum, endedAt: string | null = dayAgo) {
  return {
    pipelineRun: {
      id: 'r',
      name: 'deploy',
      startedAt: dayAgo,
      endedAt,
      status,
      input: {},
      appId: 'a',
      createdAt: dayAgo,
    },
  };
}

function dot() {
  return document.querySelector('[data-outcome]');
}

describe('ProjectLastDeployment', () => {
  it('shows a green dot when the deployment succeeded', () => {
    render(
      <ProjectLastDeployment latest={run(PipelineRunStatus_Enum.Succeeded)} />,
    );

    expect(screen.getByText('Deployed 1 day ago')).toBeInTheDocument();
    expect(dot()).toHaveAttribute('data-outcome', 'succeeded');
    expect(dot()).toHaveClass('bg-success');
  });

  it('says it failed, with a red dot', () => {
    render(
      <ProjectLastDeployment latest={run(PipelineRunStatus_Enum.Failed)} />,
    );

    expect(screen.getByText('Deploy failed 1 day ago')).toBeInTheDocument();
    expect(dot()).toHaveClass('bg-destructive');
  });

  it('shows a running deployment', () => {
    render(
      <ProjectLastDeployment
        latest={run(PipelineRunStatus_Enum.Running, null)}
      />,
    );

    expect(screen.getByText('Deploying now')).toBeInTheDocument();
    expect(dot()).toHaveAttribute('data-outcome', 'running');
  });

  it('reads legacy deployments too', () => {
    render(
      <ProjectLastDeployment
        latest={{
          deployment: {
            id: 'd',
            commitSHA: 'x',
            commitMessage: null,
            commitUserName: null,
            commitUserAvatarUrl: null,
            deploymentStartedAt: dayAgo,
            deploymentEndedAt: dayAgo,
            deploymentStatus: 'FAILED',
          },
        }}
      />,
    );

    expect(screen.getByText('Deploy failed 1 day ago')).toBeInTheDocument();
  });

  it('says when there are no deployments yet', () => {
    render(<ProjectLastDeployment latest={{}} />);

    expect(screen.getByText('No deployments yet')).toBeInTheDocument();
    expect(dot()).toBeNull();
  });
});
