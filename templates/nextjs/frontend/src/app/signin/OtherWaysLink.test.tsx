import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtherWaysLink from '@/app/signin/OtherWaysLink';

// Only the count is read, so the entries name no method, and deleting a
// method leaves nothing here that names it.
const listed = vi.hoisted(() => ({
  methods: [] as object[],
  buttons: [] as object[],
}));

vi.mock('@/app/signin/methods', () => listed);

function render(query: string): string {
  return renderToStaticMarkup(<OtherWaysLink query={query} />);
}

describe('OtherWaysLink', () => {
  beforeEach(() => {
    listed.methods = [{}, {}];
    listed.buttons = [];
  });

  // A project may keep a single method, and then there is nowhere else to go.
  it('renders nothing when there is only one method', () => {
    listed.methods = [{}];

    expect(render('?intent=sign-in')).toBe('');
  });
});
