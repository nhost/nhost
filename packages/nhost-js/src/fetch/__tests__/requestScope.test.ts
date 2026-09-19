import { requestScopeFromBaseUrl } from '../requestScope';

describe('requestScopeFromBaseUrl', () => {
  describe('contains', () => {
    it('matches the same origin regardless of path', () => {
      const scope = requestScopeFromBaseUrl('https://auth.example/v1');
      expect(scope.contains('https://auth.example/v1/token')).toBe(true);
      expect(scope.contains('https://auth.example/somewhere/else')).toBe(true);
    });

    it('is case-insensitive for scheme and host', () => {
      const scope = requestScopeFromBaseUrl('HTTPS://Auth.Example/v1');
      expect(scope.contains('https://auth.example/v1/token')).toBe(true);
    });

    it('rejects a different host', () => {
      const scope = requestScopeFromBaseUrl('https://auth.example/v1');
      expect(scope.contains('https://evil.example/v1/token')).toBe(false);
    });

    it('rejects a different scheme', () => {
      const scope = requestScopeFromBaseUrl('https://auth.example/v1');
      expect(scope.contains('http://auth.example/v1/token')).toBe(false);
    });

    it('rejects a different explicit port', () => {
      const scope = requestScopeFromBaseUrl('http://localhost:1337/v1/auth');
      expect(scope.contains('http://localhost:1337/v1/auth/token')).toBe(true);
      expect(scope.contains('http://localhost:9999/v1/auth/token')).toBe(false);
    });

    it('treats a default port as equal to an explicit one', () => {
      const scope = requestScopeFromBaseUrl('https://auth.example/v1');
      expect(scope.contains('https://auth.example:443/v1/token')).toBe(true);
    });

    it('fails closed for a relative or malformed request URL', () => {
      const scope = requestScopeFromBaseUrl('https://auth.example/v1');
      expect(scope.contains('/v1/token')).toBe(false);
      expect(scope.contains('not a url')).toBe(false);
    });

    it('fails closed for a malformed base URL', () => {
      const scope = requestScopeFromBaseUrl('not a url');
      expect(scope.contains('https://auth.example/v1/token')).toBe(false);
      expect(scope.permitsAdminSession('https://auth.example/v1', false)).toBe(
        false,
      );
    });
  });

  describe('pathPrefix', () => {
    it('strips trailing slashes', () => {
      expect(
        requestScopeFromBaseUrl('https://auth.example/v1/').pathPrefix,
      ).toBe('/v1');
      expect(
        requestScopeFromBaseUrl('http://localhost:1337/v1/auth').pathPrefix,
      ).toBe('/v1/auth');
    });

    it('is empty for a root base URL', () => {
      expect(requestScopeFromBaseUrl('https://auth.example/').pathPrefix).toBe(
        '',
      );
    });
  });

  describe('permitsAdminSession', () => {
    it('permits HTTPS', () => {
      const scope = requestScopeFromBaseUrl('https://storage.example/v1');
      expect(
        scope.permitsAdminSession('https://storage.example/v1/files', false),
      ).toBe(true);
    });

    it('refuses cleartext to a non-loopback host', () => {
      const scope = requestScopeFromBaseUrl('http://storage.example/v1');
      expect(
        scope.permitsAdminSession('http://storage.example/v1/files', false),
      ).toBe(false);
    });

    it('permits cleartext with an explicit opt-in', () => {
      const scope = requestScopeFromBaseUrl('http://storage.example/v1');
      expect(
        scope.permitsAdminSession('http://storage.example/v1/files', true),
      ).toBe(true);
    });

    it.each([
      'http://localhost:1337/v1',
      'http://127.0.0.1:1337/v1',
      'http://127.1.2.3:1337/v1',
      'http://[::1]:1337/v1',
    ])('permits cleartext to loopback host %s', (baseUrl) => {
      const scope = requestScopeFromBaseUrl(baseUrl);
      expect(scope.permitsAdminSession(`${baseUrl}/files`, false)).toBe(true);
    });

    it('does not treat a non-loopback IPv4 address as loopback', () => {
      const scope = requestScopeFromBaseUrl('http://10.0.0.1:1337/v1');
      expect(
        scope.permitsAdminSession('http://10.0.0.1:1337/v1/files', false),
      ).toBe(false);
    });

    it('refuses an off-origin URL even over HTTPS', () => {
      const scope = requestScopeFromBaseUrl('https://storage.example/v1');
      expect(
        scope.permitsAdminSession('https://evil.example/v1/files', false),
      ).toBe(false);
    });
  });
});
