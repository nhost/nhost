import getInstallExtensionSQL from './getInstallExtensionSQL';

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
