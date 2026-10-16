import { POSTGIS_SPATIAL_TYPES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

// Like the temporal helpers, these operate on the derived `baseType`. PostGIS
// is often installed in its own schema, in which case FORMAT_TYPE qualifies the
// type name (e.g. `extensions.geometry`), so the schema prefix is ignored.

const GEOJSON_GEOMETRY_TYPES = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
];

const WKT_PATTERN =
  /^\s*(SRID=\d+\s*;\s*)?(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION|CIRCULARSTRING|COMPOUNDCURVE|CURVEPOLYGON|MULTICURVE|MULTISURFACE|POLYHEDRALSURFACE|TRIANGLE|TIN)\s*(ZM|Z|M)?\s*(\(|EMPTY\s*$)/i;

const HEX_EWKB_PATTERN = /^\s*(?:[0-9a-f]{2}){5,}\s*$/i;

function getUnqualifiedTypeName(baseType?: string | null): string {
  const name = baseType ?? '';

  return name.slice(name.lastIndexOf('.') + 1).replaceAll('"', '');
}

/**
 * Whether `baseType` is a PostGIS `geometry` or `geography`.
 */
export function isSpatialType(baseType?: string | null): boolean {
  return POSTGIS_SPATIAL_TYPES.includes(getUnqualifiedTypeName(baseType));
}

/**
 * Whether `baseType` is a PostGIS `geography`.
 */
export function isGeographyType(baseType?: string | null): boolean {
  return getUnqualifiedTypeName(baseType) === 'geography';
}

/**
 * Whether `value` is a GeoJSON geometry object, either parsed or as JSON text.
 */
export function isGeoJSONGeometry(value: unknown): boolean {
  let candidate = value;

  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value);
    } catch {
      return false;
    }
  }

  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    GEOJSON_GEOMETRY_TYPES.includes(
      String((candidate as { type?: unknown }).type),
    )
  );
}

/**
 * Checks that `value` is in a text format PostGIS accepts for a column of
 * `baseType` and returns an error message, or `null` when it looks valid.
 *
 * `geometry` accepts GeoJSON, WKT/EWKT and hex EWKB. `geography` does not
 * parse GeoJSON, so only WKT/EWKT and hex EWKB are accepted there. This is a
 * shape check only; PostGIS still validates the geometry itself.
 */
export function getSpatialValueError(
  value: string,
  baseType?: string | null,
): string | null {
  if (WKT_PATTERN.test(value) || HEX_EWKB_PATTERN.test(value)) {
    return null;
  }

  if (isGeographyType(baseType)) {
    return isGeoJSONGeometry(value)
      ? 'Geography columns do not accept GeoJSON. Use WKT (e.g. SRID=4326;POINT(1 2)) or hex EWKB.'
      : 'This is not a valid geography. Use WKT (e.g. SRID=4326;POINT(1 2)) or hex EWKB.';
  }

  if (isGeoJSONGeometry(value)) {
    return null;
  }

  return 'This is not a valid geometry. Use GeoJSON, WKT (e.g. POINT(1 2)) or hex EWKB.';
}
