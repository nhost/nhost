import { isTurnstileEnabled } from './turnstile';

describe.each(['development', 'production', 'test'] as const)(
  'isTurnstileEnabled in %s',
  (nodeEnv) => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', nodeEnv);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it.each([undefined, '', 'FIXME'])(
      'disables Turnstile when the site key is %s',
      (siteKey) => {
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', siteKey);

        expect(isTurnstileEnabled()).toBe(false);
      },
    );

    it('enables a configured site key only outside development', () => {
      vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key');

      expect(isTurnstileEnabled()).toBe(nodeEnv !== 'development');
    });
  },
);
