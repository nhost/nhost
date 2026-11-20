import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { buildRoutes, routes } from '@/router';

const page = (name: string) => ({ default: () => <p>{name}</p> });

const layout = (name: string) => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-layout={name}>{children}</div>
  ),
});

function ProviderPage() {
  const { provider } = useParams();
  return <p>provider {provider}</p>;
}

const app = buildRoutes(
  {
    './app/page.tsx': page('home'),
    './app/account/page.tsx': page('account'),
    './app/auth/oauth/[provider]/page.tsx': { default: ProviderPage },
  },
  {
    './app/layout.tsx': layout('root'),
    './app/auth/layout.tsx': layout('auth'),
  },
);

const render = (path: string, from = app) =>
  renderToStaticMarkup(
    <RouterProvider
      router={createMemoryRouter(from, { initialEntries: [path] })}
    />,
  );

describe('router', () => {
  it('reads a bracketed directory as a parameter, inside every layout above it', () => {
    expect(render('/auth/oauth/github')).toBe(
      '<div data-layout="root"><div data-layout="auth"><p>provider github</p></div></div>',
    );
  });

  it('wraps a page in the layouts on its own path only', () => {
    expect(render('/account')).toBe(
      '<div data-layout="root"><p>account</p></div>',
    );
  });

  it('shows not found inside the root layout for a path without a page', () => {
    for (const path of ['/nope', '/auth', '/auth/oauth', '/auth/nope']) {
      const html = render(path);

      expect(html).toMatch(/^<div data-layout="root">/);
      expect(html).toContain('This page could not be found.');
      expect(html).not.toContain('data-layout="auth"');
    }
  });

  it('serves the home page from app/', () => {
    expect(render('/', routes)).toContain('Get started');
  });
});
