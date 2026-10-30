import { format } from 'node-pg-format';
import type { SpatialType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

// Like the temporal helpers, these operate on the derived `baseType`. PostGIS
// is often installed in its own schema, in which case FORMAT_TYPE qualifies the
// type name (e.g. `extensions.geometry`), so the schema prefix is ignored.

/**
 * Geometry types GeoJSON cannot represent, as `ST_GeometryType` names them.
 * `ST_AsGeoJSON` raises an error for them, so they are read as EWKT instead.
 * (`GeometryType` is not used because it appends `M` for measured geometries.)
 */
const NON_GEOJSON_GEOMETRY_TYPES = [
  'ST_CircularString',
  'ST_CompoundCurve',
  'ST_CurvePolygon',
  'ST_MultiCurve',
  'ST_MultiSurface',
  'ST_PolyhedralSurface',
  'ST_Tin',
  'ST_Triangle',
];

function getUnqualifiedTypeName(baseType?: string | null): string {
  const name = baseType ?? '';

  return name.slice(name.lastIndexOf('.') + 1).replaceAll('"', '');
}

/**
 * Returns the PostGIS type of a column, or `null` when it is not spatial.
 */
export function getSpatialType(baseType?: string | null): SpatialType | null {
  const name = getUnqualifiedTypeName(baseType);

  if (name === 'geometry' || name === 'geography') {
    return name;
  }

  return null;
}

/**
 * Whether `baseType` is a PostGIS `geometry` or `geography`.
 */
export function isSpatialType(baseType?: string | null): boolean {
  return getSpatialType(baseType) !== null;
}

/**
 * SQL select expression that reads a spatial column as GeoJSON, the way the
 * Hasura console and the GraphQL API do. 15 decimal digits keep full precision
 * and option `4` always includes the CRS, so the SRID survives a round-trip
 * through `ST_GeomFromGeoJSON`. Works for geometry and geography columns.
 */
export function formatSpatialColumnSelect(columnName: string): string {
  return format(
    'CASE WHEN ST_GeometryType(%I::geometry) IN (%L) THEN to_json(ST_AsEWKT(%I)) ELSE ST_AsGeoJSON(%I, 15, 4)::json END AS %I',
    columnName,
    NON_GEOJSON_GEOMETRY_TYPES,
    columnName,
    columnName,
    columnName,
  );
}

function isGeoJSON(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trimStart().startsWith('{');
  }

  return value !== null && typeof value === 'object';
}

/**
 * SQL value expression for writing `value` to a column of `spatialType`.
 * GeoJSON goes through `ST_GeomFromGeoJSON`, cast for geography since
 * geography does not parse GeoJSON itself. Anything else is sent as a plain
 * literal, since PostGIS already parses WKT, EWKT and hex EWKB.
 */
export function formatSpatialValue(
  value: unknown,
  spatialType: SpatialType,
): string {
  if (!isGeoJSON(value)) {
    return format('%L', value);
  }

  const geometry = format(
    'ST_GeomFromGeoJSON(%L)',
    typeof value === 'string' ? value : JSON.stringify(value),
  );

  return spatialType === 'geography' ? `${geometry}::geography` : geometry;
}
