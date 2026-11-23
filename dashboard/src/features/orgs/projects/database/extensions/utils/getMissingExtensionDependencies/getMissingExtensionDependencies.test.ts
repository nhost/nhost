import type { PostgresExtension } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import getMissingExtensionDependencies from './getMissingExtensionDependencies';

function extension(
  name: string,
  requires: string[] = [],
  installed = false,
): PostgresExtension {
  return {
    name,
    default_version: '1.0',
    installed_version: installed ? '1.0' : null,
    comment: null,
    requires,
  };
}

const catalog = [
  extension('plpgsql', [], true),
  extension('fuzzystrmatch'),
  extension('postgis'),
  extension('postgis_tiger_geocoder', ['postgis', 'fuzzystrmatch']),
  extension('pgrouting', ['plpgsql', 'postgis']),
  extension('vector', [], true),
  extension('pg_search', ['vector']),
  extension('chain_top', ['chain_middle']),
  extension('chain_middle', ['postgis']),
];

function getMissing(name: string) {
  return getMissingExtensionDependencies(
    catalog.find((item) => item.name === name) as PostgresExtension,
    catalog,
  );
}

describe('getMissingExtensionDependencies', () => {
  it('lists dependencies that are not installed yet', () => {
    expect(getMissing('postgis_tiger_geocoder')).toEqual([
      'postgis',
      'fuzzystrmatch',
    ]);
    expect(getMissing('pgrouting')).toEqual(['postgis']);
  });

  it('includes the dependencies of dependencies once', () => {
    expect(getMissing('chain_top')).toEqual(['chain_middle', 'postgis']);
  });

  it('is empty when every dependency is installed or there are none', () => {
    expect(getMissing('pg_search')).toEqual([]);
    expect(getMissing('postgis')).toEqual([]);
  });
});
