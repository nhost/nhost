import { linkOptions } from '@tanstack/react-router';
import type { DatabaseObjectViewModel } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Link options for a database object's page in the current project's data
 * browser: functions open by OID, tables, views and the like by name.
 */
export default function getDatabaseObjectLinkOptions(
  dataSourceSlug: string,
  databaseObject: DatabaseObjectViewModel,
) {
  if (databaseObject.objectType === 'FUNCTION') {
    return linkOptions({
      from: '/orgs/$orgSlug/projects/$appSubdomain',
      to: '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/functions/$functionOID',
      params: (prev) => ({
        ...prev,
        dataSourceSlug,
        schemaSlug: databaseObject.schema,
        functionOID: databaseObject.oid,
      }),
    });
  }

  return linkOptions({
    from: '/orgs/$orgSlug/projects/$appSubdomain',
    to: '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/tables/$tableSlug',
    params: (prev) => ({
      ...prev,
      dataSourceSlug,
      schemaSlug: databaseObject.schema,
      tableSlug: databaseObject.name,
    }),
  });
}
