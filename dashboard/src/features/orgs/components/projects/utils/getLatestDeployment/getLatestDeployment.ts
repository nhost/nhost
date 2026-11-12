import type { Project } from '@/features/orgs/components/projects/ProjectsGrid';

type PipelineRun = Project['pipelineRuns'][0];
type Deployment = Project['deployments'][0];

export interface LatestDeployment {
  pipelineRun?: PipelineRun;
  // Legacy deployment (deprecated)
  deployment?: Deployment;
}

// Picks whichever is more recent between the pipeline run and the legacy
// deployment. At most one of the two is set.
export default function getLatestDeployment(
  project: Project,
): LatestDeployment {
  const [pipelineRun] = project.pipelineRuns;
  const [deployment] = project.deployments;

  const pipelineRunDate = pipelineRun?.startedAt
    ? new Date(pipelineRun.startedAt).getTime()
    : 0;
  const deploymentDate = deployment?.deploymentStartedAt
    ? new Date(deployment.deploymentStartedAt).getTime()
    : 0;

  if (pipelineRun && pipelineRunDate >= deploymentDate) {
    return { pipelineRun };
  }

  return { deployment };
}
