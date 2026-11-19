// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtherWaysLink from '@/app/signin/OtherWaysLink.vue';
import { mountAt } from '@/test/mount';

// Only the count is read, so the entries name no method, and deleting a
// method leaves nothing here that names it.
const listed = vi.hoisted(() => ({
  methods: [] as object[],
  buttons: [] as object[],
}));

vi.mock('@/app/signin/methods', () => listed);

const render = async (query: string) =>
  (await mountAt(OtherWaysLink, '/', { props: { query } })).el;

describe('OtherWaysLink', () => {
  beforeEach(() => {
    listed.methods = [{}, {}];
    listed.buttons = [];
  });

  it('links back to the list with the query kept', async () => {
    expect(
      (await render('?intent=sign-in'))
        .querySelector('a')
        ?.getAttribute('href'),
    ).toBe('/signin?intent=sign-in');
  });

  // A project may keep a single method, and then there is nowhere else to go.
  it('renders nothing when there is only one method', async () => {
    listed.methods = [{}];

    expect((await render('?intent=sign-in')).querySelector('a')).toBeNull();
  });
});
