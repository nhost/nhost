import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { Button } from '$lib/components/ui/button';

// `svelte/server` rather than a DOM: this is about what the component renders,
// so there is nothing to mount and no environment to stand up.
const html = (props: Record<string, unknown>): string =>
  render(Button, { props }).body;

// Every UI system runs this against its own button, so the component behaves
// the same whichever one a project was scaffolded with. The shadcn-svelte
// version is the reference.
describe('Button', () => {
  it('renders a button element by default', () => {
    const out = html({});

    expect(out).toContain('<button');
    expect(out).toContain('data-slot="button"');
  });

  // What the Svelte port does instead of React's `asChild`: a button given an
  // href is a link, so a navigation styled as a button is still an anchor the
  // browser and assistive technology read as one.
  it('renders an anchor when given an href', () => {
    const out = html({ href: '/signin' });

    expect(out).toContain('<a');
    expect(out).not.toContain('<button');
    expect(out).toContain('href="/signin"');
    expect(out).toContain('data-slot="button"');
  });

  // A disabled anchor has no disabled attribute to honour, so the component
  // has to drop the href and say so, or it stays clickable.
  it('drops the href and marks a disabled link', () => {
    const out = html({ href: '/signin', disabled: true });

    expect(out).not.toContain('href="/signin"');
    expect(out).toContain('aria-disabled="true"');
  });

  it('keeps the class it is given alongside the variant classes', () => {
    const out = html({ class: 'mine', variant: 'outline', size: 'sm' });

    expect(out).toContain('mine');
    expect(out).toContain('hover:bg-muted');
  });
});
