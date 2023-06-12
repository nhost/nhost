import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { BackupListItem } from '@/features/projects/backups/components/BackupListItem';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetApplicationBackupsQuery } from '@/utils/__generated__/graphql';

export default function BackupList() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data, loading, error } = useGetApplicationBackupsQuery({
    variables: { appId: currentProject.id },
  });

  if (loading) {
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
              projectId={currentProject.id}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
