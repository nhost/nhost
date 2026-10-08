import { describe, expect, it } from 'vitest';
import {
  type Component,
  createCommentVNode,
  createSSRApp,
  defineComponent,
  h,
  renderSlot,
  type VNodeChild,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  Button,
  type ButtonVariants,
  buttonVariants,
} from '@/components/ui/button';

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
    // Once: merging the child's props twice would also bind its handlers twice.
    expect(html.match(/\bmine\b/g)).toHaveLength(1);
  });

  // What every form's submit button relies on, with or without as-child.
  it('puts its attributes on the element it renders', async () => {
    for (const html of [
      await render({ type: 'submit', disabled: true }, 'Sign in'),
      await render(
        { asChild: true, type: 'submit', disabled: true },
        h('button', null, 'Sign in'),
      ),
    ]) {
      expect(html).toContain('type="submit"');
      // Not `toContain`: the class list has `disabled:` variants in it.
      expect(html).toMatch(/\sdisabled[\s=>]/);
    }
  });

  // A wrapper that forwards its slot, which is what `<slot />` compiles to:
  // the link arrives inside a fragment rather than as the child itself.
  function forwarding(inner: Component): Component {
    return defineComponent({
      setup(_, { slots }) {
        return () => h(inner, null, () => [renderSlot(slots, 'default')]);
      },
    });
  }

  const LinkButton = defineComponent({
    setup(_, { slots }) {
      return () =>
        h(Button, { asChild: true, variant: 'ghost' }, () => [
          renderSlot(slots, 'default'),
        ]);
    },
  });

  // One fragment for each wrapper the slot was forwarded through.
  it('finds the element inside a forwarded slot under as-child', async () => {
    for (const wrapper of [LinkButton, forwarding(LinkButton)]) {
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(wrapper, null, () => h('a', { href: '/signin' }, 'Sign in')),
        }),
      );

      expect(html).toContain('href="/signin"');
      expect(html).toContain('data-slot="button"');
      expect(html).toContain('data-variant="ghost"');
      expect(html).not.toContain('<button');
    }
  });

  // What a `v-if` that is false leaves in the slot ahead of the element.
  it('skips a comment placeholder under as-child', async () => {
    const html = await render({ asChild: true }, [
      createCommentVNode('v-if', true),
      h('a', { href: '/signin' }, 'Sign in'),
    ]);

    expect(html).toMatch(/<a [^>]*data-slot="button"[^>]*>Sign in<\/a>/);
  });

  it('renders what follows the element under as-child', async () => {
    const html = await render({ asChild: true }, [
      h('a', { href: '/signin' }, 'Sign in'),
      h('span', null, 'after'),
    ]);

    expect(html).toMatch(
      /<a [^>]*data-slot="button"[^>]*>Sign in<\/a><span>after<\/span>/,
    );
  });

  it("lets the child's own attributes win under as-child", async () => {
    const html = await render(
      { asChild: true, title: 'button', 'aria-label': 'Sign in' },
      h('a', { title: 'link' }, 'Sign in'),
    );

    expect(html).toContain('title="link"');
    expect(html).not.toContain('title="button"');
    expect(html).toContain('aria-label="Sign in"');
  });

  // Typed through `ButtonVariants` so the build fails for a UI system whose
  // module does not export it.
  it('applies the variant and size classes', async () => {
    const variants: ButtonVariants = { variant: 'outline', size: 'sm' };
    const html = await render(variants, 'Sign in');

    expect(html).toContain('h-8');
    expect(html).toContain('hover:bg-accent');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('data-size="sm"');
    expect(buttonVariants(variants)).toContain('h-8');
  });
});
