import SupportLinks from '@/components/layout/Header/SupportLinks';
import { render, screen } from '@/tests/testUtils';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SupportLinks', () => {
  it.each([
    { platform: 'true', showsSupport: true },
    { platform: 'false', showsSupport: false },
    { platform: undefined, showsSupport: false },
  ])(
    'shows Support only on-platform when NEXT_PUBLIC_NHOST_PLATFORM=$platform',
    ({ platform, showsSupport }) => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', platform);

      render(<SupportLinks />);

      if (showsSupport) {
        expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute(
          'href',
          '/support',
        );
      } else {
        expect(
          screen.queryByRole('link', { name: 'Support' }),
        ).not.toBeInTheDocument();
      }
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
        'href',
        'https://docs.nhost.io',
      );
      expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute(
        'href',
        'https://status.nhost.io',
      );
    },
  );
});
