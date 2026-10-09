import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtherWaysLink from '@/signin/OtherWaysLink';

// Only the count is read, so the entries name no method: a fixture that did
// would fail the delete-method job's grep.
const listed = vi.hoisted(() => ({ methods: [] as object[] }));

vi.mock('@/signin/methods', () => listed);

function render(query: string): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <OtherWaysLink query={query} />
    </MemoryRouter>,
  );
}

describe('OtherWaysLink', () => {
  beforeEach(() => {
    listed.methods = [{}, {}];
  });

  it('goes back to sign-in carrying the query', () => {
    expect(render('?next=%2Fprotected&intent=sign-in')).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('goes back to the bare sign-in page without a query', () => {
    expect(render('')).toContain('href="/signin"');
  });

  // The default `--auth-methods` scaffolds one, so this is the common case.
  it('renders nothing when there is only one method', () => {
    listed.methods = [{}];

    expect(render('?intent=sign-in')).toBe('');
  });
});
