import { Database, Plug } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import { FormSelect } from '@/components/form/FormSelect';
import { ReadOnlyCombobox } from '@/components/presentational/ReadOnlyCombobox';
import { ReadOnlySelect } from '@/components/presentational/ReadOnlySelect';
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/v3/select';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';
import { cn, isEmptyValue } from '@/lib/utils';
import {
  type BaseRelationshipFormValues,
  ReferenceSource,
  type ToReferenceSourceValue,
} from './BaseRelationshipFormTypes';

const getTableKey = (tableSource?: string, tableSchema?: string) =>
  tableSource && tableSchema ? `${tableSource}.${tableSchema}` : null;

export default function SourceAndReferenceSelector() {
  const form = useFormContext<BaseRelationshipFormValues>();

  const { data: metadata } = useGetMetadata();

  const { data: remoteSchemas, status: remoteSchemasStatus } =
    useGetRemoteSchemas();

  const { control, watch, setValue } = form;

  const referenceKind = watch('referenceKind');

  const isTableRelationship = referenceKind === 'table';

  const allTables = useMemo(
    () =>
      metadata?.sources?.flatMap((metadataSource) =>
        (metadataSource.tables ?? []).map((table) => ({
          source: metadataSource.name!,
          schema: table.table.schema!,
          table: table.table.name!,
        })),
      ) ?? [],
    [metadata],
  );

  const { data: dataSourceNames } = useGetDataSources();
  const sourceOptions =
    dataSourceNames
      ?.sort((a, b) => a.localeCompare(b))
      .map((source) => ({
        label: source,
        value: ReferenceSource.createTypeSourceFromName(source).fullValue,
      })) ?? [];

  const schemaOptionsBySource = useMemo(() => {
    const map: Record<string, string[]> = {};

    allTables.forEach((table) => {
      if (!map[table.source]) {
        map[table.source] = [];
      }

      if (!map[table.source].includes(table.schema)) {
        map[table.source].push(table.schema);
        map[table.source].sort((a, b) => a.localeCompare(b));
      }
    });

    return map;
  }, [allTables]);

  const tablesBySourceSchema = useMemo(() => {
    const map: Record<string, string[]> = {};

    allTables.forEach((table) => {
      const key = `${table.source}.${table.schema}`;

      if (!map[key]) {
        map[key] = [];
      }

      if (!map[key].includes(table.table)) {
        map[key].push(table.table);
        map[key].sort((a, b) => a.localeCompare(b));
      }
    });

    return map;
  }, [allTables]);

  const selectedFromSource = watch('fromSource');
  const selectedToReference = watch('toReference');

  const toSchemaOptions = useMemo(
    () =>
      isTableRelationship && selectedToReference?.source
        ? (schemaOptionsBySource[selectedToReference.source] ?? [])
        : [],
    [isTableRelationship, schemaOptionsBySource, selectedToReference?.source],
  );

  const toSourceTableNames = useMemo(() => {
    const key = getTableKey(
      selectedToReference?.source,
      selectedToReference?.schema,
    );

    return key ? [...(tablesBySourceSchema[key] ?? [])] : [];
  }, [
    selectedToReference?.schema,
    selectedToReference?.source,
    tablesBySourceSchema,
  ]);

  const toTableOptions = useMemo(() => {
    const tableNames = [...toSourceTableNames];
    const currentSelection = selectedToReference?.table;

    if (
      currentSelection &&
      !tableNames.includes(currentSelection) &&
      currentSelection.length > 0
    ) {
      tableNames.unshift(currentSelection);
    }

    return tableNames.map((name) => ({
      label: name,
      value: name,
    }));
  }, [toSourceTableNames, selectedToReference?.table]);

  const remoteSchemaSelectItems = useMemo(() => {
    if (remoteSchemasStatus === 'loading') {
      return (
        <>
          <SelectSeparator />
          <SelectItem disabled value="loading">
            Loading remote schemas...
          </SelectItem>
        </>
      );
    }

    if (!remoteSchemas?.length) {
      return null;
    }
    return (
      <>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel className="font-normal text-muted-foreground">
            Remote schemas
          </SelectLabel>
          {remoteSchemas.map((remoteSchema) => (
            <SelectItem
              key={`to-remote-schema-${remoteSchema.name}`}
              value={
                ReferenceSource.createTypeRemoteSchemaFromName(
                  remoteSchema.name,
                ).fullValue
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Plug className="size-4 shrink-0 text-muted-foreground" />
                {remoteSchema.name}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </>
    );
  }, [remoteSchemas, remoteSchemasStatus]);

  return (
    <div className="flex flex-row gap-4">
      <div className="flex flex-1 flex-col gap-4 rounded-md border p-4">
        <h3 className="font-semibold text-foreground text-sm">From Source</h3>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlySelect
              label="Source"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Database className="size-4 shrink-0 text-muted-foreground" />
                  {selectedFromSource?.source ?? ''}
                </span>
              }
            />
            <ReadOnlySelect label="Schema" value={selectedFromSource?.schema} />
          </div>
          <ReadOnlyCombobox label="Table" value={selectedFromSource?.table} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 rounded-md border p-4">
        <h3 className="font-semibold text-foreground text-sm">To Reference</h3>

        <div className="space-y-4">
          <div
            className={cn('grid gap-4 sm:grid-cols-2', {
              'sm:grid-cols-2': isTableRelationship,
            })}
          >
            <FormSelect
              control={control}
              name="toReference.source"
              label="Source"
              placeholder="Select source"
              containerClassName="w-full"
              data-testid="toReferenceSourceSelect"
              transform={{
                in: (storedValue: string) => {
                  if (!storedValue) {
                    return '';
                  }

                  const referenceSource = isTableRelationship
                    ? ReferenceSource.createTypeSourceFromName(storedValue)
                    : ReferenceSource.createTypeRemoteSchemaFromName(
                        storedValue,
                      );

                  return referenceSource.fullValue;
                },
                out: (selectedValue: ToReferenceSourceValue) => {
                  const referencedSourceValue = new ReferenceSource(
                    selectedValue,
                  );
                  if (referencedSourceValue.type === 'source') {
                    const sourceName = referencedSourceValue.name;

                    setValue('referenceKind', 'table', {
                      shouldDirty: true,
                      shouldValidate: true,
                    });

                    const availableSchemas =
                      schemaOptionsBySource[sourceName] ?? [];
                    if (availableSchemas.length > 0) {
                      setValue('toReference.schema', availableSchemas[0], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }

                    return sourceName;
                  }

                  if (referencedSourceValue.type === 'remoteSchema') {
                    const remoteSchemaName = referencedSourceValue.name;

                    setValue('referenceKind', 'remoteSchema', {
                      shouldDirty: true,
                      shouldValidate: true,
                    });

                    setValue('remoteSchema.name', remoteSchemaName, {
                      shouldDirty: true,
                    });

                    setValue('toReference.table', '', {
                      shouldDirty: true,
                    });

                    setValue('toReference.source', '', {
                      shouldDirty: true,
                    });
                  }

                  return referencedSourceValue.name;
                },
              }}
            >
              <SelectGroup>
                <SelectLabel className="font-normal text-muted-foreground">
                  Databases
                </SelectLabel>
                {sourceOptions.map((option) => (
                  <SelectItem
                    key={`to-source-${option.value}`}
                    value={option.value}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Database className="size-4 shrink-0 text-muted-foreground" />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
                {sourceOptions.length === 0 && (
                  <SelectItem disabled value="__no-to-sources">
                    No sources available
                  </SelectItem>
                )}
              </SelectGroup>
              {remoteSchemaSelectItems}
            </FormSelect>

            {isTableRelationship ? (
              <FormSelect
                control={control}
                name="toReference.schema"
                label="Schema"
                placeholder="Select schema"
                containerClassName="w-full"
                data-testid="toReferenceSchemaSelect"
                disabled={!selectedToReference?.source}
                transform={{
                  in: (storedValue: string) => storedValue,
                  out: (selectedSchema: string) => {
                    if (isEmptyValue(selectedSchema)) {
                      return selectedSchema;
                    }

                    const key = getTableKey(
                      selectedToReference?.source,
                      selectedSchema,
                    );

                    const availableTables = key
                      ? [...(tablesBySourceSchema[key] ?? [])]
                      : [];

                    if (
                      availableTables.length > 0 &&
                      (!selectedToReference?.table ||
                        !availableTables.includes(selectedToReference.table))
                    ) {
                      setValue('toReference.table', availableTables[0], {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }

                    return selectedSchema;
                  },
                }}
              >
                {toSchemaOptions.map((option) => (
                  <SelectItem key={`to-schema-${option}`} value={option}>
                    {option}
                  </SelectItem>
                ))}
                {toSchemaOptions.length === 0 && (
                  <SelectItem disabled value="__no-to-schemas">
                    No schemas available
                  </SelectItem>
                )}
              </FormSelect>
            ) : (
              <ReadOnlySelect label="Schema" value="N/A" />
            )}
          </div>

          {isTableRelationship ? (
            <FormCombobox
              control={control}
              name="toReference.table"
              label="Table"
              placeholder="Select table"
              disabled={!selectedToReference?.schema}
              searchPlaceholder="Search table..."
              emptyText="No tables found."
              data-testid="toReferenceTableCombobox"
              options={toTableOptions}
            />
          ) : (
            <ReadOnlyCombobox label="Table" value="N/A" />
          )}
        </div>
      </div>
    </div>
  );
}
