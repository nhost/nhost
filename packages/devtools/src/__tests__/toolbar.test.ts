import { afterEach, describe, expect, it } from '@jest/globals';
import {
  readHidden,
  readSettings,
  writeHidden,
  writeSettings,
} from '../settings';
import {
  type DevToolbarOptions,
  mountNhostDevToolbar,
  type UnmountDevToolbar,
} from '../toolbar';

// jsdom has no PointerEvent. Every listener the toolbar registers is keyed on
// the event's type alone, so a MouseEvent carrying the same coordinates drives
// the same code.
const pointer = (type: string, x: number, y: number) =>
  new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });

const DEFAULT_EDGE = 'right';

const mounted: UnmountDevToolbar[] = [];

function mount(options?: DevToolbarOptions) {
  const unmount = mountNhostDevToolbar(options);
  mounted.push(unmount);
  return unmount;
}

const root = () => document.querySelector('.ndt-root');
const find = <T extends Element>(selector: string) => {
  const node = document.querySelector<T>(selector);
  if (!node) {
    throw new Error(`the toolbar has no ${selector}`);
  }
  return node;
};

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.();
  }
  document.body.replaceChildren();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('mounting', () => {
  it('puts the toolbar on the page for a local backend', () => {
    mount();
    expect(root()).not.toBeNull();
    expect(root()?.getAttribute('data-edge')).toBe('right');
    expect(root()?.getAttribute('data-theme')).toBe('dark');
  });

  it('links to the local stack of the configured subdomain', () => {
    mount({ subdomain: 'myapp' });
    const links = Array.from(document.querySelectorAll('.ndt-root a'), (link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual([
      'https://myapp.dashboard.local.nhost.run',
      'https://myapp.hasura.local.nhost.run',
      'https://myapp.mailhog.local.nhost.run',
    ]);
  });

  // The toolbar is only ever useful against `nhost up`: pointed at a deployed
  // project every one of those hostnames is a dead link.
  it('refuses to mount against a deployed backend', () => {
    const unmount = mount({ subdomain: 'abcdef', region: 'eu-central-1' });
    expect(root()).toBeNull();
    expect(() => unmount()).not.toThrow();
  });

  it('refuses to mount when this session hid it', () => {
    writeHidden(true);
    mount();
    expect(root()).toBeNull();
  });

  it('comes back for ?nhost-devtools=true', () => {
    writeHidden(true);
    window.history.replaceState({}, '', '/?nhost-devtools=true');
    mount();
    expect(root()).not.toBeNull();
  });

  it('restores the stored edge and theme', () => {
    writeSettings({ edge: 'top', offset: 25, theme: 'light' });
    mount();
    expect(root()?.getAttribute('data-edge')).toBe('top');
    expect(root()?.getAttribute('data-theme')).toBe('light');
  });

  it('mounts into a given target', () => {
    const target = document.createElement('div');
    document.body.append(target);
    mount({ target });
    expect(target.querySelector('.ndt-root')).not.toBeNull();
  });

  // Two toolbars on one page must not share a gradient id: the second
  // definition would win for both.
  it('gives each mounted toolbar its own gradient', () => {
    mount();
    mount();
    const ids = Array.from(
      document.querySelectorAll('linearGradient'),
      (node) => node.getAttribute('id'),
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('unmounting', () => {
  it('takes the toolbar back off the page', () => {
    const unmount = mount();
    unmount();
    expect(root()).toBeNull();
  });

  it('is safe to call twice', () => {
    const unmount = mount();
    unmount();
    expect(() => unmount()).not.toThrow();
  });

  // The listeners that carry a drag live on the window, not on the toolbar, so
  // unmounting mid-gesture has to abort them explicitly or the drop still
  // writes a new edge to storage.
  it('abandons a drag it is interrupted by', () => {
    const unmount = mount();
    find('.ndt-strip').dispatchEvent(pointer('pointerdown', 1000, 300));
    window.dispatchEvent(pointer('pointermove', 20, 400));
    unmount();
    window.dispatchEvent(pointer('pointerup', 12, 400));

    expect(readSettings().edge).toBe('right');
  });

  // A second pointer landing on the strip mid-drag opens a fresh gesture. Only
  // the latest may stay live: were the superseded one left registered, its
  // window listeners would survive teardown and the next release anywhere on
  // the page would still rewrite the persisted edge.
  it('abandons a superseded gesture it is interrupted by', () => {
    const unmount = mount();
    const strip = find('.ndt-strip');
    strip.dispatchEvent(pointer('pointerdown', 1000, 300));
    window.dispatchEvent(pointer('pointermove', 20, 400));
    strip.dispatchEvent(pointer('pointerdown', 1000, 300));
    unmount();
    window.dispatchEvent(pointer('pointerup', 12, 400));

    expect(readSettings().edge).toBe('right');
  });
});

describe('preferences', () => {
  it('opens and closes from the gear', () => {
    mount();
    const card = find('.ndt-card');
    const gear = find<HTMLElement>('[aria-label="Preferences"]');

    expect(card.getAttribute('data-open')).toBe('false');
    // Closed, the card is only faded out, so without `inert` its eight
    // controls stay in the tab order on every page of the app.
    expect(card.hasAttribute('inert')).toBe(true);

    gear.click();
    expect(card.getAttribute('data-open')).toBe('true');
    expect(card.hasAttribute('inert')).toBe(false);

    gear.click();
    expect(card.getAttribute('data-open')).toBe('false');
  });

  it('closes on Escape', () => {
    mount();
    find<HTMLElement>('[aria-label="Preferences"]').click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(find('.ndt-card').getAttribute('data-open')).toBe('false');
  });

  it('closes on a press outside the toolbar', () => {
    const outside = document.createElement('button');
    document.body.append(outside);

    mount();
    find<HTMLElement>('[aria-label="Preferences"]').click();
    outside.dispatchEvent(pointer('pointerdown', 500, 500));

    expect(find('.ndt-card').getAttribute('data-open')).toBe('false');
  });

  // A press inside the toolbar is not an outside one, or the gear would close
  // and reopen the card in a single gesture.
  it('stays open for a press on the toolbar itself', () => {
    mount();
    find<HTMLElement>('[aria-label="Preferences"]').click();
    find('.ndt-card').dispatchEvent(pointer('pointerdown', 20, 20));

    expect(find('.ndt-card').getAttribute('data-open')).toBe('true');
  });

  // An event with no element behind it still has to be handled: `contains`
  // throws on a target that is not a node.
  it('closes on a press that landed on no node at all', () => {
    mount();
    find<HTMLElement>('[aria-label="Preferences"]').click();
    window.dispatchEvent(pointer('pointerdown', 500, 500));

    expect(find('.ndt-card').getAttribute('data-open')).toBe('false');
  });

  it('moves the tab to the chosen edge and remembers it', () => {
    mount();
    const [left] = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.ndt-segment button'),
    );
    left?.click();

    expect(root()?.getAttribute('data-edge')).toBe('left');
    expect(readSettings().edge).toBe('left');
  });

  it('hides for the session and remembers that too', () => {
    mount();
    find<HTMLElement>('.ndt-hide-btn').click();

    expect(root()).toBeNull();
    expect(readHidden()).toBe(true);
  });
});

describe('dragging', () => {
  it('docks to the edge the drop landed nearest', () => {
    mount();
    const strip = find('.ndt-strip');

    strip.dispatchEvent(pointer('pointerdown', 1000, 300));
    window.dispatchEvent(pointer('pointermove', 20, 400));
    window.dispatchEvent(pointer('pointerup', 12, 400));

    expect(root()?.getAttribute('data-edge')).toBe('left');
    expect(readSettings().edge).toBe('left');
  });

  it('leaves a press that never moved to act as a click', () => {
    mount();
    const strip = find('.ndt-strip');

    strip.dispatchEvent(pointer('pointerdown', 1000, 300));
    window.dispatchEvent(pointer('pointerup', 1002, 301));

    expect(root()?.getAttribute('data-dragging')).toBe('false');
    expect(readSettings().edge).toBe(DEFAULT_EDGE);
  });

  // A real drag ends over whichever control was under the pointer, and that
  // control must not also fire.
  it('swallows the click that trails a drag', () => {
    mount();
    const strip = find('.ndt-strip');
    const gear = find<HTMLElement>('[aria-label="Preferences"]');

    strip.dispatchEvent(pointer('pointerdown', 1000, 300));
    window.dispatchEvent(pointer('pointermove', 20, 400));
    window.dispatchEvent(pointer('pointerup', 12, 400));
    gear.click();

    expect(find('.ndt-card').getAttribute('data-open')).toBe('false');
  });

  it('closes the preferences once a drag starts', () => {
    mount();
    find<HTMLElement>('[aria-label="Preferences"]').click();

    find('.ndt-strip').dispatchEvent(pointer('pointerdown', 1000, 300));
    window.dispatchEvent(pointer('pointermove', 20, 400));

    expect(find('.ndt-card').getAttribute('data-open')).toBe('false');
  });
});
