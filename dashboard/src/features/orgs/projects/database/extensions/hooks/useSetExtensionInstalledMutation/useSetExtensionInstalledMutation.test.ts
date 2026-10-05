import {
  buildExtensionMigration,
  getInstallExtensionSQL,
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
  it('quotes the name and pins the version as a literal', () => {
    expect(getInstallExtensionSQL('uuid-ossp')).toBe(
      'SET ROLE postgres;\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nRESET ROLE;',
    );
    expect(getInstallExtensionSQL('pg_cron', "1'5")).toBe(
      "SET ROLE postgres;\nCREATE EXTENSION IF NOT EXISTS pg_cron VERSION '1''5';\nRESET ROLE;",
    );
  });
});

describe('buildExtensionMigration', () => {
  it('runs the install SQL verbatim and rolls back with DROP IF EXISTS', () => {
    const sql =
      "SET ROLE postgres;\nCREATE EXTENSION vector VERSION '0.7.4';\nRESET ROLE;";

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
        'SET ROLE postgres;\nDROP EXTENSION IF EXISTS vector;\nRESET ROLE;',
      ),
    });
  });

  it('uninstalls without CASCADE and rolls back by reinstalling', () => {
    expect(
      buildExtensionMigration(
        { name: 'uuid-ossp', installed: false },
        'default',
      ),
    ).toEqual({
      name: 'drop_extension_uuid_ossp',
      datasource: 'default',
      skip_execution: false,
      up: runSql(
        'SET ROLE postgres;\nDROP EXTENSION IF EXISTS "uuid-ossp";\nRESET ROLE;',
      ),
      down: runSql(getInstallExtensionSQL('uuid-ossp')),
    });
  });
});
