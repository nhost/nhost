import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtherWaysLink from '$lib/signin/OtherWaysLink.svelte';

// Only the count is read, so the entries name no method: a fixture that did
// would fail the delete-method job's grep.
const listed = vi.hoisted(() => ({ methods: [] as object[] }));

vi.mock('$lib/signin/methods', () => listed);

const html = (query: string): string =>
  render(OtherWaysLink, { props: { query } }).body;

describe('OtherWaysLink', () => {
  beforeEach(() => {
    listed.methods = [{}, {}];
  });

  it('goes back to sign-in carrying the query', () => {
    expect(html('?next=%2Fprotected&intent=sign-in')).toContain(
      'href="/signin?next=%2Fprotected&amp;intent=sign-in"',
    );
  });

  it('goes back to the bare sign-in page without a query', () => {
    expect(html('')).toContain('href="/signin"');
  });

  // The default `--auth-methods` scaffolds one, so this is the common case.
  it('renders nothing when there is only one method', () => {
    listed.methods = [{}];

    expect(html('?intent=sign-in')).not.toContain('<a');
  });
});
