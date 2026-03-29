import { Lock, Plus, Terminal } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useDataBrowserActions } from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useGetEnumsSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetEnumsSet';
import type { DatabaseObjectViewModel } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { sortDatabaseObjects } from '@/features/orgs/projects/database/dataGrid/utils/sortDatabaseObjects';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import DatabaseObjectListItem from './DatabaseObjectListItem';

export interface DataBrowserSidebarProps {
  className?: string;
}

export interface DataBrowserSidebarContentProps {
  onSidebarItemClick?: (tablePath?: string) => void;
}

function DataBrowserSidebarContent({
  onSidebarItemClick,
}: DataBrowserSidebarContentProps) {
  const router = useRouter();

  const {
    asPath,
    query: {
      orgSlug,
      appSubdomain,
      dataSourceSlug,
      schemaSlug,
      tableSlug,
      functionOID,
    },
  } = router;

  const { data: enumTablePaths } = useGetEnumsSet({
    dataSource: dataSourceSlug as string,
  });

  const {
    data,
    status,
    error,
    refetch: refetchDatabaseQuery,
  } = useDatabaseQuery([dataSourceSlug as string]);

  const { schemas, tableLikeObjects, functions, metadata } = data || {
    schemas: [],
  };

  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const isSelectedSchemaLocked = isSchemaLocked(selectedSchema);

  const sqlEditorHref = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/editor`;

  useEffect(() => {
    if (selectedSchema) {
      return;
    }

    if (schemaSlug) {
      setSelectedSchema(schemaSlug as string);
      return;
    }

    if (schemas && schemas.length > 0) {
      const publicSchemaIndex = schemas.findIndex(
        ({ schema_name: schemaName }) => schemaName === 'public',
      );
      const index = Math.max(0, publicSchemaIndex);
      setSelectedSchema(schemas[index].schema_name);
    }
  }, [schemaSlug, schemas, selectedSchema]);

  const allObjectsInSelectedSchema: DatabaseObjectViewModel[] =
    sortDatabaseObjects(
      [
        ...(tableLikeObjects || [])
          .filter(
            (tableLikeObject) =>
              tableLikeObject.table_schema === selectedSchema,
          )
          .map((tableLikeObject) => ({
            schema: tableLikeObject.table_schema,
            name: tableLikeObject.table_name,
            objectType: tableLikeObject.table_type || 'ORDINARY TABLE',
            updatability: tableLikeObject.updatability,
          })),
        ...(functions || [])
          .filter(
            (databaseFunction) =>
              databaseFunction.function_schema === selectedSchema,
          )
          .map((databaseFunction) => ({
            schema: databaseFunction.function_schema,
            name: databaseFunction.function_name,
            objectType: 'FUNCTION' as const,
            oid: databaseFunction.function_oid,
          })),
      ],
      enumTablePaths,
    );

  const dataBrowserActions = useDataBrowserActions({
    dataSourceSlug: dataSourceSlug as string,
    schemaSlug: schemaSlug as string | undefined,
    tableSlug: tableSlug as string | undefined,
    functionOID: functionOID as string | undefined,
    selectedSchema,
    refetchDatabaseQuery,
    allObjects: allObjectsInSelectedSchema,
  });

  const displayedObjects = allObjectsInSelectedSchema.filter((obj) => {
    const isFunc = obj.objectType === 'FUNCTION';
    const objKey = isFunc
      ? `FUNCTION.${obj.schema}.${obj.oid}`
      : `${obj.schema}.${obj.name}`;
    return objKey !== dataBrowserActions.optimisticlyRemovedObject;
  });

  if (status === 'loading') {
    return (
      <Spinner
        wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
        className="h-4 w-4 justify-center"
      >
        Loading schemas and objects...
      </Spinner>
    );
  }

  if (status === 'error') {
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  if (metadata?.databaseNotFound) {
    return null;
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="box flex flex-col px-2">
        {schemas && schemas.length > 0 && (
          <Select value={selectedSchema} onValueChange={setSelectedSchema}>
            <SelectTrigger className="w-full min-w-[initial] max-w-[220px]">
              <SelectValue placeholder="Is null?" />
            </SelectTrigger>
            <SelectContent>
              {schemas.map((schema) => (
                <SelectItem value={schema.schema_name} key={schema.schema_name}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">
                      <span className="text-disabled">schema.</span>
                      <span className="font-medium">{schema.schema_name}</span>
                    </p>
                    {isSchemaLocked(schema.schema_name) && (
                      <Lock
                        className="text-[#556378] dark:text-[#a2b3be]"
                        size={12}
                      />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isSelectedSchemaLocked && (
          <Button
            variant="link"
            className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
            onClick={() => {
              dataBrowserActions.openCreateTableDrawer();
              onSidebarItemClick?.();
            }}
          >
            New Table <Plus className="h-4 w-4" />
          </Button>
        )}
        {isNotEmptyValue(schemas) && isEmptyValue(displayedObjects) && (
          <p className="px-2 py-1.5 text-disabled text-xs">No objects found.</p>
        )}
        <nav aria-label="Database navigation">
          {isNotEmptyValue(displayedObjects) && (
            <ul className="w-full max-w-full pb-6">
              {displayedObjects.map((databaseObject) => {
                const isFunction = databaseObject.objectType === 'FUNCTION';
                const keyIdentifier = isFunction
                  ? databaseObject.oid
                  : databaseObject.name;

                return (
                  <DatabaseObjectListItem
                    key={`${databaseObject.objectType}.${databaseObject.schema}.${keyIdentifier}`}
                    databaseObject={databaseObject}
                    dataBrowserActions={dataBrowserActions}
                    onSidebarItemClick={onSidebarItemClick}
                  />
                );
              })}
            </ul>
          )}
        </nav>
      </div>

      <div className="box border-t">
        <Button
          size="sm"
          variant="link"
          asChild
          className={cn(
            'flex rounded-none border text-sm+ hover:bg-accent hover:no-underline group-focus-within:pr-9 group-hover:pr-9 group-active:pr-9',
            { 'bg-table-selected text-primary-main': asPath === sqlEditorHref },
          )}
        >
          <NextLink href={sqlEditorHref}>
            <div className="flex w-full flex-row items-center justify-center space-x-4">
              <Terminal />
              <span className="flex">SQL Editor</span>
            </div>
          </NextLink>
        </Button>
      </div>
    </div>
  );
}

export default function DataBrowserSidebar({
  className,
}: DataBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function handleSidebarItemClick() {
    setExpanded(false);
  }

  useEffect(() => {
    function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', closeSidebarWhenEscapeIsPressed);
    }

    return () =>
      document.removeEventListener('keydown', closeSidebarWhenEscapeIsPressed);
  }, []);

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute top-0 right-0 bottom-0 left-0 z-[34] sm:hidden"
        role="button"
        tabIndex={-1}
        onClick={() => setExpanded(false)}
        aria-label="Close sidebar overlay"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          setExpanded(false);
        }}
      />

      <aside
        className={cn(
          'box absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pt-2 pb-17 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pt-2.5 sm:pb-0 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
      >
        <RetryableErrorBoundary>
          <DataBrowserSidebarContent
            onSidebarItemClick={handleSidebarItemClick}
          />
        </RetryableErrorBoundary>
      </aside>

      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 left-8 z-[38] h-11 w-11 rounded-full bg-primary md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </Button>
    </>
  );
}
