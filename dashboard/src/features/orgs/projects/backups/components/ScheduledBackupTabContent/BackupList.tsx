import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetApplicationBackupsQuery } from '@/utils/__generated__/graphql';
import BackupListItem from './BackupListItem';

export interface BackupListProps {
  sourceAppId?: string;
  sourceProjectName?: string;
  dialogTitle?: string;
  submitButtonText?: string;
}

export default function BackupList({
  sourceAppId,
  sourceProjectName,
  dialogTitle,
  submitButtonText,
}: BackupListProps) {
  const { project, loading: loadingProject } = useProject();
  const effectiveAppId = sourceAppId ?? project?.id;

  const {
    data,
    loading: loadingBackups,
    error,
  } = useGetApplicationBackupsQuery({
    variables: { appId: effectiveAppId },
    skip: !effectiveAppId,
  });

  if (!effectiveAppId || (!sourceAppId && loadingProject) || loadingBackups) {
    return <Spinner>Loading backups...</Spinner>;
  }

  if (error) {
    throw error;
  }

  const backups = data?.app?.backups;

  return (
    <Table containerClassName="rounded-md bg-background">
      <TableHeader>
        <TableRow>
          <TableHead className="text-foreground">Date</TableHead>
          <TableHead className="text-foreground">Size</TableHead>
          <TableHead className="text-foreground">Backed up</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>

      <TableBody>
        {!backups?.length && (
          <TableRow>
            <TableCell>
              <p className="text-muted-foreground text-xs">
                No backups are available.
              </p>
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
        )}

        {backups?.map((backup) => (
          <BackupListItem
            key={backup.id}
            backup={backup}
            sourceAppId={effectiveAppId}
            sourceProjectName={sourceProjectName}
            dialogTitle={dialogTitle}
            submitButtonText={submitButtonText}
          />
        ))}
      </TableBody>
    </Table>
  );
}
