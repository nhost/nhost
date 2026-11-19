import getUninstallExtensionSQL from './getUninstallExtensionSQL';

describe('getUninstallExtensionSQL', () => {
  it('drops without CASCADE', () => {
    expect(getUninstallExtensionSQL('uuid-ossp')).toBe(
      'SET LOCAL ROLE postgres;\nDROP EXTENSION IF EXISTS "uuid-ossp";',
    );
  });

  it('uninstalls pg_durable with CASCADE', () => {
    expect(getUninstallExtensionSQL('pg_durable')).toBe(
      'SET LOCAL ROLE postgres;\nDROP EXTENSION IF EXISTS pg_durable CASCADE;',
    );
  });
});
