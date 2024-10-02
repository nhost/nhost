import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { BackupListItem } from '@/features/orgs/projects/backups/components/BackupListItem';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetApplicationBackupsQuery } from '@/utils/__generated__/graphql';

export default function BackupList() {
  const { project, loading: loadingProject } = useProject();

  const {
    data,
    loading: loadingBackups,
    error,
  } = useGetApplicationBackupsQuery({
    variables: { appId: project?.id },
    skip: loadingProject,
  });

  if (loadingProject || loadingBackups) {
    return (
      <ActivityIndicator
        delay={500}
        className="my-5"
        label="Loading backups..."
      />
    );
  }

  if (error) {
    throw error;
  }

  const { backups } = data.app;

  return (
    <TableContainer sx={{ backgroundColor: 'background.paper' }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Backed up</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>

        <TableBody>
          {backups.length === 0 && (
            <TableRow>
              <TableCell>
                <Text className="text-xs" color="secondary">
                  No backups are available.
                </Text>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
            </TableRow>
          )}

          {backups.map((backup) => (
            <BackupListItem
              key={backup.id}
              backup={backup}
              projectId={project.id}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
