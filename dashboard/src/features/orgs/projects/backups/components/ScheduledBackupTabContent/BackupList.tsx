import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import type { BackupOperation } from '@/features/orgs/projects/backups/components/common/backup-operation';
import { useGetApplicationBackupsQuery } from '@/generated/graphql';
import BackupListItem from './BackupListItem';

export interface BackupListProps {
  appId?: string;
  sourceProjectName?: string;
  operation?: BackupOperation;
}

export default function BackupList({
  appId,
  sourceProjectName,
  operation = 'restore',
}: BackupListProps) {
  const {
    data,
    loading: loadingBackups,
    error,
  } = useGetApplicationBackupsQuery({
    variables: { appId },
    skip: !appId,
  });

  if (!appId || loadingBackups) {
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
            appId={appId}
            sourceProjectName={sourceProjectName}
            operation={operation}
          />
        ))}
      </TableBody>
    </Table>
  );
}
