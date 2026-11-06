import {
  formatSpatialColumnSelect,
  formatSpatialValue,
  getSpatialType,
  isSpatialType,
} from './spatialTypeHelpers';

describe('getSpatialType', () => {
  it('returns the PostGIS type, schema-qualified or not', () => {
    expect(getSpatialType('geometry')).toBe('geometry');
    expect(getSpatialType('geography')).toBe('geography');
    expect(getSpatialType('extensions.geometry')).toBe('geometry');
    expect(getSpatialType('"extensions"."geography"')).toBe('geography');
  });

  it('returns null for native geometric and other types', () => {
    expect(getSpatialType('point')).toBeNull();
    expect(getSpatialType('polygon')).toBeNull();
    expect(getSpatialType('jsonb')).toBeNull();
    expect(getSpatialType(undefined)).toBeNull();
    expect(getSpatialType(null)).toBeNull();
  });
});

describe('isSpatialType', () => {
  it('matches geometry and geography only', () => {
    expect(isSpatialType('geometry')).toBe(true);
    expect(isSpatialType('extensions.geography')).toBe(true);
    expect(isSpatialType('point')).toBe(false);
    expect(isSpatialType(undefined)).toBe(false);
  });
});

describe('formatSpatialColumnSelect', () => {
  it('reads the column as GeoJSON with full precision and the CRS', () => {
    const sql = formatSpatialColumnSelect('location');

    expect(sql).toContain('ST_AsGeoJSON(location, 15, 4)::json');
    expect(sql).toMatch(/ AS location$/);
  });

  it('falls back to EWKT for geometry types GeoJSON cannot represent', () => {
    const sql = formatSpatialColumnSelect('curve');

    expect(sql).toContain(
      "CASE WHEN ST_GeometryType(curve::geometry) IN ('ST_CircularString','ST_CompoundCurve','ST_CurvePolygon','ST_MultiCurve','ST_MultiSurface','ST_PolyhedralSurface','ST_Tin','ST_Triangle') THEN to_json(ST_AsEWKT(curve))",
    );
  });

  it('quotes column names that need it', () => {
    const sql = formatSpatialColumnSelect('Shape Col');

    expect(sql).toContain('ST_AsGeoJSON("Shape Col", 15, 4)::json');
    expect(sql).toMatch(/ AS "Shape Col"$/);
  });
});

describe('formatSpatialValue', () => {
  const point = '{"type":"Point","coordinates":[1,2]}';

  it('parses GeoJSON text with ST_GeomFromGeoJSON', () => {
    expect(formatSpatialValue(point, 'geometry')).toBe(
      `ST_GeomFromGeoJSON('${point}')`,
    );
  });

  it('casts GeoJSON for geography columns', () => {
    expect(formatSpatialValue(point, 'geography')).toBe(
      `ST_GeomFromGeoJSON('${point}')::geography`,
    );
  });

  it('accepts a GeoJSON object', () => {
    expect(
      formatSpatialValue({ type: 'Point', coordinates: [1, 2] }, 'geometry'),
    ).toBe(`ST_GeomFromGeoJSON('${point}')`);
  });

  it('ignores whitespace before GeoJSON text', () => {
    expect(formatSpatialValue(`\n  ${point}`, 'geometry')).toContain(
      'ST_GeomFromGeoJSON(',
    );
  });

  it.each([
    'POINT(1 2)',
    'SRID=4326;LINESTRING(0 0,1 1)',
    'POLYGON EMPTY',
    '0101000020E610000000000000000008400000000000001040',
  ])('sends %s as a plain literal for both spatial types', (value) => {
    expect(formatSpatialValue(value, 'geometry')).toBe(`'${value}'`);
    expect(formatSpatialValue(value, 'geography')).toBe(`'${value}'`);
  });

  it('escapes quotes inside literals', () => {
    expect(
      formatSpatialValue("POINT(1 2)'; DROP TABLE t; --", 'geometry'),
    ).toBe("'POINT(1 2)''; DROP TABLE t; --'");
    expect(
      formatSpatialValue(
        '{"type":"Point","coordinates":[1,2],"x":"\'"}',
        'geometry',
      ),
    ).toBe(
      'ST_GeomFromGeoJSON(\'{"type":"Point","coordinates":[1,2],"x":"\'\'"}\')',
    );
  });
});
