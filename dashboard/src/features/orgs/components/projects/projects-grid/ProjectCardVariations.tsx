// TEMPORARY demo for the team review on staging: every look a project card can
// have, with fake projects. Delete this file and its one line in
// projects-grid.tsx once the cards are approved.
import { PipelineRunStatus_Enum } from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { type Project, ProjectCard } from './projects-grid';

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

function fakeProject({
  name,
  status,
  repo,
  run,
}: {
  name: string;
  status: ApplicationStatus;
  repo?: string;
  run?: { status: PipelineRunStatus_Enum; endedMinutesAgo?: number };
}): Project {
  return {
    id: `demo-${name}`,
    name,
    slug: name,
    subdomain: `demo-${name}`,
    createdAt: ago(60 * 24 * 30),
    region: { id: 'demo', name: 'eu-central-1' },
    githubRepository: repo ? { fullName: repo } : null,
    repositoryProductionBranch: 'main',
    deployments: [],
    pipelineRuns: run
      ? [
          {
            id: `demo-run-${name}`,
            name: 'deploy',
            status: run.status,
            startedAt: ago((run.endedMinutesAgo ?? 0) + 3),
            endedAt:
              run.endedMinutesAgo === undefined
                ? null
                : ago(run.endedMinutesAgo),
            input: { commit_user_name: 'Rui Almeida' },
            appId: `demo-${name}`,
            createdAt: ago((run.endedMinutesAgo ?? 0) + 3),
          },
        ]
      : [],
    creator: null,
    appStates: [
      {
        id: `demo-state-${name}`,
        appId: `demo-${name}`,
        stateId: status,
        createdAt: ago(10),
      },
    ],
  } as Project;
}

const VARIATIONS: { label: string; project: Project; issues?: string[] }[] = [
  {
    label: 'Live, no GitHub',
    project: fakeProject({
      name: 'Empty project',
      status: ApplicationStatus.Live,
    }),
  },
  {
    label: 'Live, GitHub connected, never deployed',
    project: fakeProject({
      name: 'Fresh repo',
      status: ApplicationStatus.Live,
      repo: 'acme/fresh-repo',
    }),
  },
  {
    label: 'Live, deployed',
    project: fakeProject({
      name: 'Shop backend',
      status: ApplicationStatus.Live,
      repo: 'acme/shop-backend',
      run: { status: PipelineRunStatus_Enum.Succeeded, endedMinutesAgo: 120 },
    }),
  },
  {
    label: 'Deploying right now',
    project: fakeProject({
      name: 'Marketing site',
      status: ApplicationStatus.Live,
      repo: 'acme/marketing-site',
      run: { status: PipelineRunStatus_Enum.Running },
    }),
  },
  {
    label: 'Last deployment failed (hover the warning)',
    project: fakeProject({
      name: 'Billing service',
      status: ApplicationStatus.Live,
      repo: 'acme/billing',
      run: { status: PipelineRunStatus_Enum.Failed, endedMinutesAgo: 45 },
    }),
  },
  {
    label: 'Services unhealthy (hover the warning)',
    project: fakeProject({
      name: 'Analytics',
      status: ApplicationStatus.Live,
      repo: 'acme/analytics',
      run: { status: PipelineRunStatus_Enum.Succeeded, endedMinutesAgo: 600 },
    }),
    issues: ['Storage has an error', 'Auth failed to update'],
  },
  {
    label: 'Paused',
    project: fakeProject({
      name: 'Old prototype',
      status: ApplicationStatus.Paused,
    }),
  },
  {
    label: 'Pausing',
    project: fakeProject({
      name: 'Weekend test',
      status: ApplicationStatus.Pausing,
    }),
  },
  {
    label: 'Waking up',
    project: fakeProject({
      name: 'Side project',
      status: ApplicationStatus.Unpausing,
    }),
  },
  {
    label: 'Restoring a backup',
    project: fakeProject({
      name: 'Staging copy',
      status: ApplicationStatus.Restoring,
    }),
  },
  {
    label: 'Error',
    project: fakeProject({
      name: 'Broken build',
      status: ApplicationStatus.Errored,
    }),
  },
  {
    label: 'Still being created (no pill)',
    project: fakeProject({
      name: 'Brand new',
      status: ApplicationStatus.Provisioning,
    }),
  },
  {
    label: 'Very long names',
    project: fakeProject({
      name: 'A project with a really long name that does not fit on one line',
      status: ApplicationStatus.Live,
      repo: 'a-very-long-organization-name/an-even-longer-repository-name',
      run: {
        status: PipelineRunStatus_Enum.Succeeded,
        endedMinutesAgo: 60 * 24 * 3,
      },
    }),
  },
];

export default function ProjectCardVariations() {
  return (
    <section className="mx-auto mt-12 w-full max-w-5xl px-5">
      <div className="rounded-lg border border-warning/50 border-dashed p-4">
        <h2 className="font-semibold text-xl">Card variations (demo)</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Fake projects showing every look a project card can have, for review
          only. This section will be removed before release.
        </p>
      </div>
      <div className="mt-4 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VARIATIONS.map(({ label, project, issues }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              {label}
            </span>
            {/* Not clickable: hovering still shows the border light and tooltips. */}
            <div className="flex-1 [&_a]:pointer-events-none">
              <ProjectCard project={project} previewIssues={issues} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
