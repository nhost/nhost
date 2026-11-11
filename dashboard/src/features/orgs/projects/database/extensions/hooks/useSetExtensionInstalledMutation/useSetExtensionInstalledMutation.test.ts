import { getInstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getInstallExtensionSQL';
import { getUninstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getUninstallExtensionSQL';
import { buildExtensionMigration } from './useSetExtensionInstalledMutation';

function runSql(sql: string) {
  return [
    {
      type: 'run_sql',
      args: { cascade: false, read_only: false, source: 'default', sql },
    },
  ];
}

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
});
