import { describe, expect, it } from '@jest/globals';
import { isLocalBackend, localServiceUrls } from '../config';

describe('localServiceUrls', () => {
  it('builds the local nhost.run URLs for each service', () => {
    expect(localServiceUrls()).toEqual({
      dashboard: 'https://local.dashboard.local.nhost.run',
      hasura: 'https://local.hasura.local.nhost.run',
      mailhog: 'https://local.mailhog.local.nhost.run',
    });
  });

  it('follows the configured subdomain', () => {
    expect(localServiceUrls({ subdomain: 'myapp' }).hasura).toBe(
      'https://myapp.hasura.local.nhost.run',
    );
  });

  // A framework that has no value to pass hands through an empty string rather
  // than omitting the property, and `local` is still the right answer.
  it('treats an empty subdomain as the local stack', () => {
    expect(localServiceUrls({ subdomain: '' }).dashboard).toBe(
      'https://local.dashboard.local.nhost.run',
    );
  });
});

// Everything the toolbar links to belongs to `nhost up`, so an app pointed at a
// deployed backend must not show it: those hostnames do not resolve there.
describe('isLocalBackend', () => {
  it('is true for the local stack, including when nothing is set', () => {
    expect(isLocalBackend()).toBe(true);
    expect(isLocalBackend({})).toBe(true);
    expect(isLocalBackend({ region: 'local' })).toBe(true);
    expect(isLocalBackend({ region: '' })).toBe(true);
  });

  it('is false for a deployed region', () => {
    expect(isLocalBackend({ region: 'eu-central-1' })).toBe(false);
    expect(isLocalBackend({ subdomain: 'abcdef', region: 'us-east-1' })).toBe(
      false,
    );
  });
});
