import SupportLinks from '@/components/layout/Header/SupportLinks';
import { render, screen } from '@/tests/testUtils';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SupportLinks', () => {
  it.each([
    { platform: 'true', showsPlatformLinks: true },
    { platform: 'false', showsPlatformLinks: false },
    { platform: undefined, showsPlatformLinks: false },
  ])(
    'shows Support and Status only on-platform when NEXT_PUBLIC_NHOST_PLATFORM=$platform',
    ({ platform, showsPlatformLinks }) => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', platform);

      render(<SupportLinks />);

      if (showsPlatformLinks) {
        expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute(
          'href',
          '/support',
        );
        expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute(
          'href',
          'https://status.nhost.io',
        );
      } else {
        expect(
          screen.queryByRole('link', { name: 'Support' }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole('link', { name: 'Status' }),
        ).not.toBeInTheDocument();
      }
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
        'href',
        'https://docs.nhost.io',
      );
    },
  );
});
