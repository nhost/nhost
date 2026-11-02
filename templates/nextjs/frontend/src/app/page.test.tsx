import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

const getUserSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({ getUserSession }),
}));
vi.mock('@/lib/nhost/actions', () => ({ signOutAndGoHome: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

const render = () => Home().then(renderToStaticMarkup);

describe('home page', () => {
  beforeEach(() => {
    getUserSession.mockReset();
  });

  // The one page behind the session, so it is where a signed-in visitor is sent
  // from here.
  it('sends a signed-in visitor to the account page', async () => {
    getUserSession.mockReturnValueOnce({ user: { email: 'ada@example.com' } });

    const html = await render();

    expect(html).toContain('signed in as ada@example.com');
    expect(hrefOf(html, 'Go to your account')).toBe('/account');
    expect(hrefOf(html, 'Sign up')).toBeUndefined();
  });
});
