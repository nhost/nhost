export const EXTENSIONS_DOCS_URL =
  'https://docs.nhost.io/products/database/extensions';

export const POPULAR_EXTENSIONS = ['vector', 'postgis', 'pg_cron', 'uuid-ossp'];

// Keep in sync with services/postgres/postgres/etc/postgresql.conf.tmpl:747.
export const PRELOAD_REQUIRED_EXTENSIONS = new Set([
  'pg_stat_statements',
  'pg_cron',
  'timescaledb',
  'pg_squeeze',
  'pg_search',
]);

const CREATED_AT_INIT =
  'Created during database initialization and used by the authentication and storage schemas.';

export const PROTECTED_EXTENSIONS = new Map([
  ['plpgsql', 'Required by database triggers and functions.'],
  ['pgcrypto', CREATED_AT_INIT],
  ['citext', CREATED_AT_INIT],
]);
