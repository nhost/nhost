import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import Home from '@/app/page';

function hrefOf(html: string, label: string): string | undefined {
  return new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1];
}

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe('home page', () => {
  it('sends a signed-out visitor to sign up, or to sign in another way', () => {
    const html = render();

    expect(hrefOf(html, 'Sign up')).toBe('/signin');
    expect(hrefOf(html, 'another way in')).toBe('/signin?intent=sign-in');
  });
});
