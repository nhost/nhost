import {
  getSpatialValueError,
  isGeographyType,
  isGeoJSONGeometry,
  isSpatialType,
} from './spatialTypeHelpers';

describe('isSpatialType', () => {
  it('matches PostGIS base types, schema-qualified or not', () => {
    expect(isSpatialType('geometry')).toBe(true);
    expect(isSpatialType('geography')).toBe(true);
    expect(isSpatialType('extensions.geometry')).toBe(true);
    expect(isSpatialType('"extensions"."geography"')).toBe(true);
  });

  it('does not match native geometric or other types', () => {
    expect(isSpatialType('point')).toBe(false);
    expect(isSpatialType('polygon')).toBe(false);
    expect(isSpatialType('jsonb')).toBe(false);
    expect(isSpatialType(undefined)).toBe(false);
    expect(isSpatialType(null)).toBe(false);
  });
});

describe('isGeographyType', () => {
  it('only matches geography', () => {
    expect(isGeographyType('geography')).toBe(true);
    expect(isGeographyType('extensions.geography')).toBe(true);
    expect(isGeographyType('geometry')).toBe(false);
  });
});

describe('isGeoJSONGeometry', () => {
  it.each([
    { type: 'Point', coordinates: [1, 2] },
    '{"type":"LineString","coordinates":[[0,0],[1,1]]}',
    {
      type: 'Point',
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      coordinates: [1, 2],
    },
  ])('accepts %j', (value) => {
    expect(isGeoJSONGeometry(value)).toBe(true);
  });

  it.each([
    { type: 'Feature', geometry: null },
    '{"type":"Point"',
    '[1, 2]',
    'POINT(1 2)',
    null,
    42,
  ])('rejects %j', (value) => {
    expect(isGeoJSONGeometry(value)).toBe(false);
  });
});

describe('getSpatialValueError', () => {
  const point = '{"type":"Point","coordinates":[1,2]}';

  it.each([
    'POINT(1 2)',
    'point z (1 2 3)',
    'SRID=4326;POINT(1 2)',
    'MULTIPOLYGON(((0 0,1 0,1 1,0 0)))',
    'POLYGON EMPTY',
    '0101000020E610000000000000000008400000000000001040',
  ])('accepts %s for both spatial types', (value) => {
    expect(getSpatialValueError(value, 'geometry')).toBeNull();
    expect(getSpatialValueError(value, 'geography')).toBeNull();
  });

  it('accepts GeoJSON for geometry', () => {
    expect(getSpatialValueError(point, 'geometry')).toBeNull();
  });

  it('explains that geography does not accept GeoJSON', () => {
    expect(getSpatialValueError(point, 'geography')).toMatch(
      /Geography columns do not accept GeoJSON/,
    );
  });

  it.each([
    'not a geometry',
    'POINT',
    'SRID=4326;',
    '0101',
    '{"type":"Feature"}',
  ])('rejects %s', (value) => {
    expect(getSpatialValueError(value, 'geometry')).toMatch(
      /not a valid geometry/,
    );
    expect(getSpatialValueError(value, 'geography')).toMatch(
      /not a valid geography/,
    );
  });
});
