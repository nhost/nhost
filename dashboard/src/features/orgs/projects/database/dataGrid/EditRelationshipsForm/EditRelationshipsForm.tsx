import { ArrowRight, Link2, Plug as PlugIcon, Split } from 'lucide-react';
import { useRouter } from 'next/router';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import type { BaseTableFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { CreateRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/CreateRelationshipDialog';
import { DeleteRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/DeleteRelationshipDialog';
import { EditRemoteRelationshipButton } from '@/features/orgs/projects/database/dataGrid/components/EditRemoteRelationshipButton';
import { RenameRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/RenameRelationshipDialog';
import useGetRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships/useGetRelationships';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isRemoteRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import SuggestedRelationshipsSection from './sections/SuggestedRelationshipsSection';

export interface EditRelationshipsFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table data.
   */
  table: NormalizedQueryDataRow;
}

export default function EditRelationshipsForm(
  props: EditRelationshipsFormProps,
) {
  const { onCancel, schema, table: originalTable } = props;
  const router = useRouter();
  const dataSource =
    (router.query.dataSourceSlug as string | undefined) || 'default';

  const {
    relationships: existingRelationshipsViewModel,
    isLoading: isRelationshipsLoading,
  } = useGetRelationships({
    dataSource,
    schema,
    tableName: originalTable.table_name,
  });
  const tableQueryKey = [`${dataSource}.${schema}.${originalTable.table_name}`];

  const {
    status: tableStatus,
    error: tableError,
  } = useTableQuery(tableQueryKey, {
    schema,
    table: originalTable.table_name,
  });

  const tableName = originalTable.table_name as string;
  const tableSchema = (originalTable.table_schema as string) || schema;

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    router.back();
  };

  if (isRelationshipsLoading || tableStatus === 'loading') {
    return (
      <div className="px-6">
        <ActivityIndicator label="Loading relationships..." delay={1000} />
      </div>
    );
  }

  if (tableStatus === 'error') {
    let errorMessage =
      'An error occurred while loading the relationships. Please try again.';

    if (tableError instanceof Error) {
      errorMessage = tableError.message;
    }

    return (
      <div className="-mt-3 px-6">
        <Alert severity="error" className="text-left">
          <strong>Error:</strong> {errorMessage}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <section className="px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground text-sm+">
                Relationships
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Manage foreign key relationships for{' '}
                <span className="font-mono">
                  {tableSchema}.{tableName}
                </span>
              </p>
            </div>
            <CreateRelationshipDialog
              source={dataSource}
              schema={tableSchema}
              tableName={tableName}
            />
          </div>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[120px]">Source</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingRelationshipsViewModel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <p className="py-6 text-center text-muted-foreground text-sm">
                        No relationships found for this table.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  existingRelationshipsViewModel.map((relationship) => (
                    <TableRow key={relationship.name}>
                      <TableCell className="font-medium">
                        {relationship.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isRemoteRelationshipViewModel(relationship) ? (
                            <span>
                              <PlugIcon className="h-4 w-4 text-muted-foreground" />{' '}
                              {relationship.toSource}
                            </span>
                          ) : (
                            <span>{relationship.fromSource}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {relationship.type === 'Array' ? (
                            <Split className="h-4 w-4 rotate-90 text-muted-foreground" />
                          ) : (
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{relationship.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                          <span>{relationship.fromLabel}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span>{relationship.toLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="flex flex-row items-center gap-2">
                        <DeleteRelationshipDialog
                          schema={schema}
                          tableName={tableName}
                          relationshipToDelete={relationship.name}
                          source={relationship.fromSource}
                          isRemoteRelationship={relationship.kind === 'remote'}
                        />
                        {isRemoteRelationshipViewModel(relationship) ? (
                          <EditRemoteRelationshipButton
                            schema={tableSchema}
                            tableName={tableName}
                            source={dataSource}
                            relationshipName={relationship.name}
                            relationshipDefinition={relationship.definition}
                          />
                        ) : (
                          <RenameRelationshipDialog
                            schema={schema}
                            tableName={tableName}
                            relationshipToRename={relationship.name}
                            source={relationship.fromSource}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
        <SuggestedRelationshipsSection
          tableSchema={tableSchema}
          tableName={tableName}
          dataSource={dataSource}
        />
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button variant="outline" color="secondary" onClick={handleCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}
