import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import Nav from '@/components/Nav';

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

describe('Nav', () => {
  it('offers a signed-out visitor both ways in', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>,
    );

    expect(hrefOf(html, 'Sign in')).toBe('/signin?intent=sign-in');
    expect(hrefOf(html, 'Sign up')).toBe('/signin');
    expect(html).not.toContain('href="/account"');
  });
});
