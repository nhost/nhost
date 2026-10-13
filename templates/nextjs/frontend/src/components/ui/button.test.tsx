import { type ComponentProps, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';

type Props = Record<string, unknown>;

// What `asChild` hands its child. The probe records the props rather than
// rendering them, so handlers and refs can be called without a DOM.
function slotted(button: ComponentProps<typeof Button>, child: Props) {
  let received: Props = {};

  function Probe(props: Props) {
    received = props;
    return null;
  }

  renderToStaticMarkup(
    <Button asChild {...button}>
      <Probe {...child} />
    </Button>,
  );

  return received;
}

// Every UI system runs this against its own button.tsx, so `asChild` behaves
// the same whichever one a project was scaffolded with. The shadcn/ui version
// gets it from `@radix-ui/react-slot`, which makes that the reference.
describe('Button asChild', () => {
  it('runs both click handlers, the child first', () => {
    const calls: string[] = [];
    const props = slotted(
      { onClick: () => calls.push('button') },
      { onClick: () => calls.push('child') },
    );

    (props.onClick as VoidFunction)();

    expect(calls).toEqual(['child', 'button']);
  });

  it('keeps the button handler when the child passes undefined', () => {
    const onClick = vi.fn();
    const props = slotted({ onClick }, { onClick: undefined });

    (props.onClick as VoidFunction)();

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('merges styles, the child winning a clash', () => {
    const props = slotted(
      { style: { color: 'red', margin: 1 } },
      { style: { color: 'blue' } },
    );

    expect(props.style).toEqual({ color: 'blue', margin: 1 });
  });

  it('keeps both class names', () => {
    const props = slotted({ className: 'theirs' }, { className: 'mine' });

    expect(props.className).toContain('theirs');
    expect(props.className).toContain('mine');
  });

  it('sets both refs', () => {
    const buttonRef = createRef<HTMLButtonElement>();
    const childRef = vi.fn();
    const props = slotted({ ref: buttonRef }, { ref: childRef });
    const node = {} as HTMLButtonElement;

    (props.ref as (node: HTMLButtonElement) => void)(node);

    expect(buttonRef.current).toBe(node);
    expect(childRef).toHaveBeenCalledWith(node);
  });

  it('refuses a child that is not a single element', () => {
    expect(() =>
      renderToStaticMarkup(<Button asChild>Sign in</Button>),
    ).toThrow();
  });
});
