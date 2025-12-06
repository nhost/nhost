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
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import type { BaseTableFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useSuggestRelationshipsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type {
  ExportMetadataResponseMetadataSourcesItemTablesItemArrayRelationshipsItem,
  ExportMetadataResponseMetadataSourcesItemTablesItemObjectRelationshipsItem,
  SuggestRelationshipsResponseRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Link2,
  PencilIcon,
  PlusIcon,
  Split,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import AddSuggestedRelationshipDialog from './AddSuggestedRelationshipDialog';
import CreateRelationshipDialog from './CreateRelationshipDialog';
import DeleteRelationshipDialog from './DeleteRelationshipDialog';
import RenameRelationshipDialog from './RenameRelationshipDialog';

type MetadataArrayRelationship =
  ExportMetadataResponseMetadataSourcesItemTablesItemArrayRelationshipsItem;
type MetadataObjectRelationship =
  ExportMetadataResponseMetadataSourcesItemTablesItemObjectRelationshipsItem;
type MetadataRelationship =
  | MetadataArrayRelationship
  | MetadataObjectRelationship;

export interface EditRelationshipsFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table to be edited.
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
  const queryClient = useQueryClient();

  const {
    status: tableStatus,
    error: tableError,
    data: tableData,
    refetch: refetchTableData,
  } = useTableQuery([`default.${schema}.${originalTable.table_name}`], {
    schema,
    table: originalTable.table_name,
  });

  const [showDeleteRelationshipDialog, setShowDeleteRelationshipDialog] =
    useState(false);

  const [showRenameRelationshipDialog, setShowRenameRelationshipDialog] =
    useState(false);

  const [selectedRelationshipForDelete, setSelectedRelationshipForDelete] =
    useState<{ name: string; source: string } | null>(null);

  const [selectedRelationshipForRename, setSelectedRelationshipForRename] =
    useState<{ name: string; source: string } | null>(null);

  const [showCreateRelationshipDialog, setShowCreateRelationshipDialog] =
    useState(false);

  const [
    showAddSuggestedRelationshipDialog,
    setShowAddSuggestedRelationshipDialog,
  ] = useState(false);

  const [selectedSuggestedRelationship, setSelectedSuggestedRelationship] =
    useState<SuggestRelationshipsResponseRelationshipsItem | null>(null);

  const { data: suggestions } = useSuggestRelationshipsQuery(dataSource);

  const tableSuggestions = suggestions?.relationships?.filter(
    (suggestion) =>
      suggestion.from?.table?.name === originalTable.table_name &&
      suggestion.from?.table?.schema === schema,
  );

  const {
    data: metadata,
    isLoading: isMetadataLoading,
    error: metadataError,
  } = useGetMetadata();

  const sourceMetadata = metadata?.sources?.find(
    (source) => source.name === dataSource,
  );

  const tableMetadataItem = sourceMetadata?.tables?.find(
    (item) =>
      item.table.name === originalTable.table_name &&
      item.table.schema === schema,
  );

  const arrayRelationships =
    (tableMetadataItem?.array_relationships as
      | MetadataArrayRelationship[]
      | undefined) ?? [];
  const objectRelationships =
    (tableMetadataItem?.object_relationships as
      | MetadataObjectRelationship[]
      | undefined) ?? [];

  const isDirty = false;
  const tableName = originalTable.table_name as string;
  const tableSchema = (originalTable.table_schema as string) || schema;

  const foreignKeyRelations =
    (tableData?.foreignKeyRelations as NormalizedQueryDataRow[]) ?? [];
  const tableColumns =
    (tableData?.columns as NormalizedQueryDataRow[] | undefined) ?? [];

  const primaryKeyColumns = tableColumns
    .filter(
      (column) =>
        Array.isArray(column?.primary_constraints) &&
        column.primary_constraints.length > 0,
    )
    .map((column) => column.column_name as string)
    .filter(Boolean);

  const formatEndpoint = (
    schemaName: string | undefined,
    name: string | undefined,
    columns: string[],
  ) => {
    const qualifiedTable = `${schemaName ?? 'public'}.${
      name ?? 'unknown_table'
    }`;
    const formattedColumns =
      columns.length > 0 ? columns.join(', ') : 'Not specified';

    return `${qualifiedTable} / ${formattedColumns}`;
  };

  const normalizeColumns = (value: unknown): string[] => {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((column) => column.toString());
    }

    if (typeof value === 'object') {
      const foreignKeyObject = value as Record<string, unknown>;

      if ('columns' in foreignKeyObject && foreignKeyObject.columns) {
        return normalizeColumns(foreignKeyObject.columns);
      }

      if ('column' in foreignKeyObject && foreignKeyObject.column) {
        return [String(foreignKeyObject.column)];
      }
    }

    if (typeof value === 'string') {
      return [value];
    }

    return [];
  };

  const buildRelationshipRow = (
    relationship: MetadataRelationship,
    type: 'Array' | 'Object',
  ) => {
    const { name, using } = relationship;

    if (!name || !using) {
      return null;
    }

    let localColumns: string[] = [];
    let remoteColumns: string[] = [];
    let remoteSchema: string | undefined;
    let remoteTable: string | undefined;

    if ('manual_configuration' in using && using.manual_configuration) {
      const mappingEntries = Object.entries(
        using.manual_configuration.column_mapping ?? {},
      );
      localColumns = mappingEntries.map(([localColumn]) => localColumn);
      remoteColumns = mappingEntries.map(([, remoteColumn]) =>
        remoteColumn.toString(),
      );
      remoteSchema = using.manual_configuration.remote_table?.schema;
      remoteTable = using.manual_configuration.remote_table?.name;
    } else if ('foreign_key_constraint_on' in using) {
      const foreignKeyConstraint = using.foreign_key_constraint_on;

      if (typeof foreignKeyConstraint === 'string') {
        localColumns = [foreignKeyConstraint];

        if (type === 'Object') {
          const matchingRelation = foreignKeyRelations.find(
            (relation) => relation.columnName === foreignKeyConstraint,
          );

          if (matchingRelation) {
            remoteSchema = matchingRelation.referencedSchema ?? tableSchema;
            remoteTable = matchingRelation.referencedTable;
            remoteColumns = normalizeColumns(matchingRelation.referencedColumn);
          }
        } else {
          remoteColumns = [foreignKeyConstraint];
        }
      } else if (foreignKeyConstraint) {
        const foreignKeyRecord = foreignKeyConstraint as Record<
          string,
          unknown
        >;
        const foreignKeyTable = foreignKeyRecord.table as
          | { schema?: string; name?: string }
          | undefined;

        remoteSchema = foreignKeyTable?.schema;
        remoteTable = foreignKeyTable?.name;

        const normalizedColumns = normalizeColumns(foreignKeyConstraint);

        if (type === 'Object') {
          localColumns = normalizedColumns;
        } else {
          remoteColumns = normalizedColumns;
        }
      }
    } else {
      return null;
    }

    if (type === 'Array' && localColumns.length === 0) {
      localColumns = primaryKeyColumns;
    }

    const structuralKey = JSON.stringify({
      type,
      from: {
        schema: tableSchema,
        table: tableName,
        columns: localColumns,
      },
      to: {
        schema: remoteSchema ?? tableSchema,
        table: remoteTable ?? tableName,
        columns: remoteColumns,
      },
    });

    const keyParts = [
      type,
      name,
      remoteSchema ?? tableSchema,
      remoteTable ?? tableName,
      ...localColumns,
      ...remoteColumns,
    ];

    return {
      key: keyParts.join('-'),
      structuralKey,
      name,
      source: dataSource,
      type,
      from: formatEndpoint(tableSchema, tableName, localColumns),
      to: formatEndpoint(remoteSchema, remoteTable, remoteColumns),
    };
  };

  const relationships = [
    ...arrayRelationships.map((relationship) =>
      buildRelationshipRow(relationship, 'Array'),
    ),
    ...objectRelationships.map((relationship) =>
      buildRelationshipRow(relationship, 'Object'),
    ),
  ].filter(Boolean) as Array<{
    key: string;
    structuralKey: string;
    name: string;
    source: string;
    type: string;
    from: string;
    to: string;
  }>;

  const existingRelationshipKeys = new Set(
    relationships.map((relationship) => relationship.structuralKey),
  );

  const suggestedRelationships = (tableSuggestions ?? [])
    .map((suggestion) => {
      const typeLabel =
        suggestion.type && suggestion.type.toLowerCase() === 'array'
          ? 'Array'
          : 'Object';

      const fromElement = suggestion.from;
      const toElement = suggestion.to;

      const localColumns = normalizeColumns(fromElement?.columns);
      const remoteColumns = normalizeColumns(toElement?.columns);

      const name =
        toElement?.constraint_name ??
        fromElement?.constraint_name ??
        toElement?.table?.name ??
        `${typeLabel.toLowerCase()}_relationship`;

      const key = [
        'suggested',
        typeLabel,
        fromElement?.table?.schema,
        fromElement?.table?.name,
        ...localColumns,
        toElement?.table?.schema,
        toElement?.table?.name,
        ...remoteColumns,
      ]
        .filter(Boolean)
        .join('-');

      const structuralKey = JSON.stringify({
        type: typeLabel,
        from: {
          schema: fromElement?.table?.schema ?? tableSchema,
          table: fromElement?.table?.name ?? tableName,
          columns: localColumns,
        },
        to: {
          schema: toElement?.table?.schema ?? tableSchema,
          table: toElement?.table?.name ?? tableName,
          columns: remoteColumns,
        },
      });

      if (existingRelationshipKeys.has(structuralKey)) {
        return null;
      }

      return {
        key: key || name,
        structuralKey,
        name,
        source: dataSource,
        type: typeLabel,
        from: formatEndpoint(
          fromElement?.table?.schema,
          fromElement?.table?.name,
          localColumns,
        ),
        to: formatEndpoint(
          toElement?.table?.schema,
          toElement?.table?.name,
          remoteColumns,
        ),
        rawSuggestion: suggestion,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    structuralKey: string;
    name: string;
    source: string;
    type: string;
    from: string;
    to: string;
    rawSuggestion: SuggestRelationshipsResponseRelationshipsItem;
  }>;

  const handleRelationshipCreated = async () => {
    const tableQueryKey = [`default.${schema}.${originalTable.table_name}`];

    await Promise.allSettled([
      queryClient.invalidateQueries(tableQueryKey),
      refetchTableData(),
      queryClient.invalidateQueries(['suggest-relationships', dataSource]),
    ]);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    router.back();
  };

  if (isMetadataLoading || tableStatus === 'loading') {
    return (
      <div className="px-6">
        <ActivityIndicator label="Loading relationships..." delay={1000} />
      </div>
    );
  }

  if (metadataError || tableStatus === 'error') {
    let errorMessage =
      'An error occurred while loading the relationships. Please try again.';

    if (metadataError instanceof Error) {
      errorMessage = metadataError.message;
    } else if (tableError instanceof Error) {
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
              <h2 className="text-sm+ font-semibold text-foreground">
                Relationships
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage foreign key relationships for {tableSchema}.{tableName}.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              className="mt-2 flex w-fit items-center gap-2 sm:mt-0"
              onClick={() => setShowCreateRelationshipDialog(true)}
            >
              Relationship
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            <Table>
              {/* <TableCaption>
                Relationships for {tableSchema}.{tableName}
              </TableCaption> */}
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
                {relationships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No relationships found for this table.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  relationships.map((relationship) => (
                    <TableRow key={relationship.key}>
                      <TableCell className="font-medium">
                        {relationship.name}
                      </TableCell>
                      <TableCell>{relationship.source}</TableCell>
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
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{relationship.from}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span>{relationship.to}</span>
                        </div>
                      </TableCell>
                      <TableCell className="flex flex-row items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setSelectedRelationshipForDelete({
                              name: relationship.name,
                              source: relationship.source,
                            });
                            setShowDeleteRelationshipDialog(true);
                          }}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className=""
                          onClick={() => {
                            setSelectedRelationshipForRename({
                              name: relationship.name,
                              source: relationship.source,
                            });
                            setShowRenameRelationshipDialog(true);
                          }}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DeleteRelationshipDialog
            open={showDeleteRelationshipDialog}
            setOpen={(nextOpen) => {
              if (!nextOpen) {
                setSelectedRelationshipForDelete(null);
              }
              setShowDeleteRelationshipDialog(nextOpen);
            }}
            schema={schema}
            tableName={tableName}
            relationshipToDelete={
              selectedRelationshipForDelete?.name ??
              relationships[0]?.name ??
              ''
            }
            source={
              selectedRelationshipForDelete?.source ??
              relationships[0]?.source ??
              dataSource
            }
          />
          <RenameRelationshipDialog
            open={showRenameRelationshipDialog}
            setOpen={(nextOpen) => {
              if (!nextOpen) {
                setSelectedRelationshipForRename(null);
              }
              setShowRenameRelationshipDialog(nextOpen);
            }}
            schema={schema}
            tableName={tableName}
            relationshipToRename={
              selectedRelationshipForRename?.name ??
              relationships[0]?.name ??
              ''
            }
            source={
              selectedRelationshipForRename?.source ??
              relationships[0]?.source ??
              dataSource
            }
            onSuccess={handleRelationshipCreated}
          />
          <CreateRelationshipDialog
            open={showCreateRelationshipDialog}
            setOpen={setShowCreateRelationshipDialog}
            source={dataSource}
            schema={tableSchema}
            tableName={tableName}
            onSuccess={handleRelationshipCreated}
          />
        </section>

        <section className="px-6">
          <h2 className="text-sm+ font-semibold text-foreground">
            Suggested Relationships
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Review suggested relationships for {tableSchema}.{tableName}.
          </p>

          <div className="mt-4">
            <Table>
              {/* <TableCaption>
                Suggested relationships for {tableSchema}.{tableName}
              </TableCaption> */}
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
                {suggestedRelationships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No suggested relationships available.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  suggestedRelationships.map((suggestion) => (
                    <TableRow key={suggestion.key}>
                      <TableCell className="font-medium">
                        {suggestion.name}
                      </TableCell>
                      <TableCell>{suggestion.source}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {suggestion.type === 'Array' ? (
                            <Split className="h-4 w-4 rotate-90 text-muted-foreground" />
                          ) : (
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{suggestion.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{suggestion.from}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span>{suggestion.to}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSuggestedRelationship(
                              suggestion.rawSuggestion,
                            );
                            setShowAddSuggestedRelationshipDialog(true);
                          }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <AddSuggestedRelationshipDialog
          open={showAddSuggestedRelationshipDialog}
          setOpen={(nextOpen) => {
            if (!nextOpen) {
              setSelectedSuggestedRelationship(null);
            }
            setShowAddSuggestedRelationshipDialog(nextOpen);
          }}
          schema={tableSchema}
          tableName={tableName}
          source={dataSource}
          suggestion={selectedSuggestedRelationship}
          onSuccess={handleRelationshipCreated}
        />
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button
          variant="outline"
          color="secondary"
          onClick={handleCancel}
          tabIndex={isDirty ? -1 : 0}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
