import { describe, expect, it } from 'vitest';
import { createSSRApp, h, type VNodeChild } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Button } from '@/components/ui/button';

// The server renderer rather than a DOM: this is about what the component
// renders, so there is nothing to mount and no environment to stand up.
function render(
  props: Record<string, unknown>,
  children: VNodeChild,
): Promise<string> {
  return renderToString(
    createSSRApp({ render: () => h(Button, props, () => children) }),
  );
}

// Every UI system runs this against its own button, so the component behaves
// the same whichever one a project was scaffolded with. The shadcn-vue version
// gets `as-child` from reka-ui's `Primitive`, which makes that the reference.
describe('Button', () => {
  it('renders a button element by default', async () => {
    const html = await render({}, 'Sign in');

    expect(html).toContain('<button');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('Sign in');
  });

  it('renders the element `as` names', async () => {
    const html = await render({ as: 'a' }, 'Sign in');

    expect(html).toContain('<a');
    expect(html).not.toContain('<button');
  });

  // What `as-child` is for: a link stays a link, and takes on the button's
  // look. Anything else and a RouterLink inside a Button would render a button
  // wrapping an anchor, which nests two interactive elements.
  it('keeps the child element as itself under as-child', async () => {
    const html = await render(
      { asChild: true },
      h('a', { href: '/signin' }, 'Sign in'),
    );

    expect(html).toContain('<a');
    expect(html).not.toContain('<button');
    expect(html).toContain('href="/signin"');
    expect(html).toContain('data-slot="button"');
  });

  it('keeps both class names under as-child', async () => {
    const html = await render(
      { asChild: true, class: 'theirs' },
      h('a', { class: 'mine' }, 'Sign in'),
    );

    expect(html).toContain('theirs');
    expect(html).toContain('mine');
  });

  it('applies the variant and size classes', async () => {
    const html = await render({ variant: 'outline', size: 'sm' }, 'Sign in');

    expect(html).toContain('h-8');
    expect(html).toContain('hover:bg-accent');
  });
});
