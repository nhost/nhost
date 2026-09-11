import { Download, Play } from 'lucide-react';
import { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import BackupList from '@/features/orgs/projects/backups/components/ScheduledBackupsContent/BackupList';
import { useDownloadBackup } from '@/features/orgs/projects/backups/hooks/useDownloadBackup';
import { useUnpauseProject } from '@/features/orgs/projects/common/hooks/useUnpauseProject';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { useGetApplicationBackupsQuery } from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';

export interface OverviewPausedStateProps {
  state: ApplicationStatus;
}

const TRANSIENT_STATES: ApplicationStatus[] = [
  ApplicationStatus.Pausing,
  ApplicationStatus.Unpausing,
  ApplicationStatus.Restoring,
];

export default function OverviewPausedState({
  state,
}: OverviewPausedStateProps) {
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const { handleTriggerUnpausing, loading: wakingUp } = useUnpauseProject();
  const [showAllBackups, setShowAllBackups] = useState(false);

  const isFreeOrg = !!org?.plan?.isFree;

  const { data, loading: loadingBackups } = useGetApplicationBackupsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
  });
  const backups = data?.app?.backups ?? [];
  const latestBackup = backups[0];

  const { downloadBackup, loading: downloadingLatest } = useDownloadBackup(
    project?.id ?? '',
    latestBackup?.id ?? '',
  );

  const isTransientState = TRANSIENT_STATES.includes(state);

  return (
    <Container>
      <div className="mx-auto mt-12 flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border p-8 text-center">
        {isTransientState ? (
          <ProjectStatusPill status={state} />
        ) : (
          <>
            <h2 className="font-semibold text-lg">
              {project?.name} is paused
            </h2>

            <ButtonWithLoading
              loading={wakingUp}
              onClick={handleTriggerUnpausing}
              className="w-full sm:w-auto"
            >
              <Play className="mr-2 h-4 w-4" />
              Wake up
            </ButtonWithLoading>

            {!loadingBackups && latestBackup && (
              <div className="mt-2 w-full border-t pt-4 text-left">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-medium text-sm">Export your data</p>
                    <p className="text-muted-foreground text-xs">
                      Download the backup made when this project was paused.
                    </p>
                  </div>
                  <ButtonWithLoading
                    variant="outline-emboss"
                    size="sm"
                    loading={downloadingLatest}
                    onClick={downloadBackup}
                    className="w-full sm:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isFreeOrg ? 'Download backup' : 'Download the latest backup'}
                  </ButtonWithLoading>
                </div>

                {!isFreeOrg && (
                  <Collapsible
                    open={showAllBackups}
                    onOpenChange={setShowAllBackups}
                    className="mt-3"
                  >
                    <CollapsibleTrigger className="text-primary text-sm underline underline-offset-4 hover:no-underline">
                      {showAllBackups ? 'Hide all backups' : 'Show all backups'}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <BackupList appId={project?.id} />
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
