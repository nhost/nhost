import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtherWaysLink from './OtherWaysLink.svelte';

// Only the count is read, so the entries name no method, and deleting a
// method leaves nothing here that names it.
const listed = vi.hoisted(() => ({
  methods: [] as object[],
  buttons: [] as object[],
}));

vi.mock('./methods.ts', () => listed);

const html = (query: string): string =>
  render(OtherWaysLink, { props: { query } }).body;

describe('OtherWaysLink', () => {
  beforeEach(() => {
    listed.methods = [{}, {}];
    listed.buttons = [];
  });

  // A project may keep a single method, and then there is nowhere else to go.
  it('renders nothing when there is only one method', () => {
    listed.methods = [{}];

    expect(html('?intent=sign-in')).not.toContain('<a');
  });

  it('links back to the list, keeping the query', () => {
    expect(html('?intent=sign-in')).toContain('href="/signin?intent=sign-in"');
  });
});
