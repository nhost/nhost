import { useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
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

const BACKUPS_PER_PAGE = 10;

export default function BackupList({
  appId,
  sourceProjectName,
  operation = 'restore',
}: BackupListProps) {
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
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
  const totalNrOfElements = backups?.length ?? 0;
  const totalNrOfPages = Math.max(
    Math.ceil(totalNrOfElements / BACKUPS_PER_PAGE),
    1,
  );
  const visibleBackups = backups?.slice(
    (currentPageNumber - 1) * BACKUPS_PER_PAGE,
    currentPageNumber * BACKUPS_PER_PAGE,
  );

  return (
    <div className="grid grid-flow-row gap-3">
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
          {!visibleBackups?.length && (
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

          {visibleBackups?.map((backup) => (
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

      {totalNrOfElements > BACKUPS_PER_PAGE && (
        <Pagination
          totalNrOfPages={totalNrOfPages}
          elementsPerPage={BACKUPS_PER_PAGE}
          totalNrOfElements={totalNrOfElements}
          itemsLabel="backups"
          currentPageNumber={currentPageNumber}
          onPrevPageClick={() =>
            setCurrentPageNumber((page) => Math.max(page - 1, 1))
          }
          onNextPageClick={() =>
            setCurrentPageNumber((page) => Math.min(page + 1, totalNrOfPages))
          }
          onPageChange={setCurrentPageNumber}
        />
      )}
    </div>
  );
}
