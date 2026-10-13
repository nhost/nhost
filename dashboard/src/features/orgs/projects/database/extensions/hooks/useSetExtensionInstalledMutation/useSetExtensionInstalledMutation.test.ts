import {
  buildExtensionMigration,
  getDropExtensionStatement,
  getInstallExtensionSQL,
  getUninstallExtensionSQL,
} from './useSetExtensionInstalledMutation';

function runSql(sql: string) {
  return [
    {
      type: 'run_sql',
      args: { cascade: false, read_only: false, source: 'default', sql },
    },
  ];
}

describe('getInstallExtensionSQL', () => {
  it('quotes the name and installs the default version', () => {
    expect(getInstallExtensionSQL('uuid-ossp')).toBe(
      'SET LOCAL ROLE postgres;\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    );
  });

  it('adds CASCADE only when asked to install dependencies', () => {
    expect(getInstallExtensionSQL('pg_search', { cascade: true })).toBe(
      'SET LOCAL ROLE postgres;\nCREATE EXTENSION IF NOT EXISTS pg_search CASCADE;',
    );
  });
});

describe('getDropExtensionStatement', () => {
  it('drops without CASCADE unless the extension needs it', () => {
    expect(getDropExtensionStatement('uuid-ossp')).toBe(
      'DROP EXTENSION IF EXISTS "uuid-ossp"',
    );
    expect(getDropExtensionStatement('pg_durable')).toBe(
      'DROP EXTENSION IF EXISTS pg_durable CASCADE',
    );
  });
});

describe('buildExtensionMigration', () => {
  it('runs the install SQL verbatim and rolls back with DROP IF EXISTS', () => {
    const sql = 'SET LOCAL ROLE postgres;\nCREATE EXTENSION vector;';

    expect(
      buildExtensionMigration(
        { name: 'vector', installed: true, sql: `\n${sql}\n` },
        'default',
      ),
    ).toEqual({
      name: 'create_extension_vector',
      datasource: 'default',
      skip_execution: false,
      up: runSql(sql),
      down: runSql(
        'SET LOCAL ROLE postgres;\nDROP EXTENSION IF EXISTS vector;',
      ),
    });
  });

  it('runs the uninstall SQL verbatim and rolls back by reinstalling', () => {
    const sql = getUninstallExtensionSQL('uuid-ossp');

    expect(sql).toBe(
      'SET LOCAL ROLE postgres;\nDROP EXTENSION IF EXISTS "uuid-ossp";',
    );
    expect(
      buildExtensionMigration(
        { name: 'uuid-ossp', installed: false, sql },
        'default',
      ),
    ).toEqual({
      name: 'drop_extension_uuid_ossp',
      datasource: 'default',
      skip_execution: false,
      up: runSql(sql),
      down: runSql(getInstallExtensionSQL('uuid-ossp')),
    });
  });

  it('uninstalls pg_durable with CASCADE', () => {
    expect(getUninstallExtensionSQL('pg_durable')).toBe(
      'SET LOCAL ROLE postgres;\nDROP EXTENSION IF EXISTS pg_durable CASCADE;',
    );
  });
});
