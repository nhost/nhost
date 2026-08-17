import { getHasuraMetadataExportApiUrl } from '@/utils/env';

const originalEnv = { ...process.env };

function setMigrationsApiUrl(url?: string) {
  process.env = { ...originalEnv };

  if (url === undefined) {
    delete process.env.NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL;
  } else {
    process.env.NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL = url;
  }
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getHasuraMetadataExportApiUrl', () => {
  it('derives the export URL from the default migrations URL', () => {
    setMigrationsApiUrl(undefined);

    expect(getHasuraMetadataExportApiUrl()).toBe(
      'https://local.hasura.local.nhost.run/apis/metadata',
    );
  });

  it('derives the export URL from a custom migrations URL', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/migrate');

    expect(getHasuraMetadataExportApiUrl()).toBe(
      'https://custom.migrate.example/apis/metadata',
    );
  });

  it('accepts a trailing slash on the migrations pathname', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/migrate/');

    expect(getHasuraMetadataExportApiUrl()).toBe(
      'https://custom.migrate.example/apis/metadata',
    );
  });

  it('preserves a reverse-proxy path prefix', () => {
    setMigrationsApiUrl('https://gateway.example/base/apis/migrate');

    expect(getHasuraMetadataExportApiUrl()).toBe(
      'https://gateway.example/base/apis/metadata',
    );
  });

  it('preserves a non-default port', () => {
    setMigrationsApiUrl('http://localhost:9693/apis/migrate');

    expect(getHasuraMetadataExportApiUrl()).toBe(
      'http://localhost:9693/apis/metadata',
    );
  });

  it('rejects a migrations URL with a query string', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/migrate?foo=bar');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow(
      'must not contain a query string or fragment',
    );
  });

  it('rejects a migrations URL with a fragment', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/migrate#section');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow(
      'must not contain a query string or fragment',
    );
  });

  it('rejects a migrations URL with a bare trailing query delimiter', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/migrate?');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow(
      'must not contain a query string or fragment',
    );
  });

  it('rejects a migrations URL with a bare trailing fragment delimiter', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/migrate#');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow(
      'must not contain a query string or fragment',
    );
  });

  it('rejects a migrations URL whose pathname does not end with /apis/migrate', () => {
    setMigrationsApiUrl('https://custom.migrate.example/apis/other');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow(
      'must end with "/apis/migrate"',
    );
  });

  it('rejects a migrations URL that only partially matches the migrate segment', () => {
    setMigrationsApiUrl('https://custom.migrate.example/xapis/migrate');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow(
      'must end with "/apis/migrate"',
    );
  });

  it('rejects an invalid migrations URL', () => {
    setMigrationsApiUrl('not-a-valid-url');

    expect(() => getHasuraMetadataExportApiUrl()).toThrow('is not a valid URL');
  });
});
