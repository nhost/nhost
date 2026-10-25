// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DialogClose } from '@/components/Dialog';
import { DialogSetting, SettingsList } from '@/components/Setting';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const button = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

async function click(label: string): Promise<void> {
  await act(async () => button(label)?.click());
}

const dialog = (): HTMLDialogElement | null =>
  container.querySelector('dialog');

// A field that keeps what was typed in it, to tell a fresh form from a kept
// one.
function Draft() {
  const [text, setText] = useState('');
  return (
    <>
      <input value={text} onChange={(event) => setText(event.target.value)} />
      <DialogClose />
    </>
  );
}

describe('dialog setting', () => {
  beforeEach(async () => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <SettingsList>
          <DialogSetting
            label="Email"
            value="a@b.c"
            action="Change"
            title="Change email"
            description="A link goes to the new address."
          >
            <Draft />
          </DialogSetting>
        </SettingsList>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the label, the value and the button, with the dialog shut', () => {
    expect(container.textContent).toContain('Emaila@b.c');
    expect(button('Change')?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialog()?.open).toBe(false);
    expect(dialog()?.querySelector('input')).toBeNull();
  });

  it('opens the dialog, titled, from the row button', async () => {
    await click('Change');

    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent).toContain('Change email');
    expect(dialog()?.textContent).toContain('A link goes to the new address.');
    expect(
      container.querySelector(
        `[id="${dialog()?.getAttribute('aria-labelledby')}"]`,
      )?.textContent,
    ).toBe('Change email');
  });

  // Otherwise the next opening would show whatever was abandoned in it.
  it('closes from Cancel and opens fresh the next time', async () => {
    await click('Change');
    const input = dialog()?.querySelector('input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set?.call(input, 'half typed');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await click('Cancel');
    expect(dialog()?.open).toBe(false);

    await click('Change');
    expect(dialog()?.querySelector('input')?.value).toBe('');
  });
});
