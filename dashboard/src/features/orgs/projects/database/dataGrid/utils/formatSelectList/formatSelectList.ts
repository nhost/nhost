import { format } from 'node-pg-format';
import { formatSpatialColumnSelect } from '@/features/orgs/projects/database/dataGrid/utils/spatialTypeHelpers';

export interface SelectListColumn {
  /**
   * Name of the column.
   */
  name: string;
  /**
   * Whether the column is read through PostGIS as GeoJSON instead of as is.
   */
  isSpatial: boolean;
}

/**
 * Formats the select list of a row query. Columns are listed explicitly, in
 * order, so PostGIS columns can be read as GeoJSON; every other column is
 * selected as is. Without column metadata the query falls back to `*`.
 */
export default function formatSelectList(columns: SelectListColumn[]): string {
  if (columns.length === 0) {
    return '*';
  }

  return columns
    .map(({ name, isSpatial }) =>
      isSpatial ? formatSpatialColumnSelect(name) : format('%I', name),
    )
    .join(', ');
}
