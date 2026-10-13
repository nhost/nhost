import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';

const search = vi.hoisted(() => ({ current: '' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

const render = (query: string) => {
  search.current = query;
  return renderToStaticMarkup(<AuthErrorFromUrl />);
};

describe('AuthErrorFromUrl', () => {
  it('shows why an auth redirect failed', () => {
    const html = render(
      'error=disabled-endpoint&errorDescription=This+endpoint+is+disabled',
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('This endpoint is disabled');
    expect(html).toContain('(disabled-endpoint)');
  });

  it('shows no notice on an ordinary visit', () => {
    expect(render('')).toBe('');
    expect(render('next=%2Fprotected')).toBe('');
  });

  it('needs the code, not only a description', () => {
    expect(render('errorDescription=x')).toBe('');
  });
});
