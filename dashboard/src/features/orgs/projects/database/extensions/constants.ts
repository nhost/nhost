export const EXTENSIONS_DOCS_URL =
  'https://docs.nhost.io/products/database/extensions';

export const POPULAR_EXTENSIONS = ['vector', 'postgis', 'pg_cron', 'uuid-ossp'];

// Mirror the `sharedPreloadLibraries` default and the `PostgresPreloadLibrary`
// values of the nhost.toml configuration. Each library is named after the
// extension that needs it.
export const DEFAULT_PRELOADED_LIBRARIES = [
  'pg_stat_statements',
  'pg_cron',
  'timescaledb',
  'pg_squeeze',
  'pg_search',
];

export const PRELOAD_LIBRARY_EXTENSIONS = new Set([
  ...DEFAULT_PRELOADED_LIBRARIES,
  'pg_durable',
  'pg_ivm',
]);

const CREATED_AT_INIT =
  'Created during database initialization and used by the authentication and storage schemas.';

export const PROTECTED_EXTENSIONS = new Map([
  ['plpgsql', 'Required by database triggers and functions.'],
  ['pgcrypto', CREATED_AT_INIT],
  ['citext', CREATED_AT_INIT],
]);

// A plain DROP fails for these extensions because they create objects that
// are not part of the extension. The value describes what CASCADE deletes.
export const CASCADE_UNINSTALL_EXTENSIONS = new Map([
  [
    'pg_durable',
    'This also deletes all pg_durable workflow state: workflow definitions, statuses, results, and variables.',
  ],
]);
