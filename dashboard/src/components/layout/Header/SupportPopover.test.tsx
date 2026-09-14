import { vi } from 'vitest';
import SupportPopover from '@/components/layout/Header/SupportPopover';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

mockPointerEvent();

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SupportPopover', () => {
  it.each([
    { platform: 'true', showsSupport: true },
    { platform: 'false', showsSupport: false },
    { platform: undefined, showsSupport: false },
  ])(
    'shows Support only on-platform when NEXT_PUBLIC_NHOST_PLATFORM=$platform',
    async ({ platform, showsSupport }) => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', platform);
      const user = new TestUserEvent();

      render(<SupportPopover />);

      await user.click(
        screen.getByRole('button', { name: 'Help and support' }),
      );

      expect(
        await screen.findByText('Resources to keep you shipping.'),
      ).toBeInTheDocument();

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
      expect(
        screen.getByRole('link', { name: /Join us on Discord/ }),
      ).toHaveAttribute('href', 'https://discord.com/invite/9V7Qb2U');
    },
  );
});
