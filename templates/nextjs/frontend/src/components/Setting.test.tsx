// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExpandableSetting, SettingsList } from '@/components/Setting';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const link = (action: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) =>
      button.textContent === action ||
      button.getAttribute('aria-label') === `Close: ${action}`,
  );

const isOpen = (action: string): boolean =>
  link(action)?.getAttribute('aria-expanded') === 'true';

describe('settings list', () => {
  beforeEach(async () => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <SettingsList>
          <ExpandableSetting label="Email" value="a@b.c" action="Change email">
            <p>Email form</p>
          </ExpandableSetting>
          <ExpandableSetting label="Password" value="•••" action="Change">
            <p>Password form</p>
          </ExpandableSetting>
        </SettingsList>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the label, the value and the link, all closed', () => {
    expect(container.textContent).toContain('Emaila@b.c');
    expect(isOpen('Change email')).toBe(false);
    expect(isOpen('Change')).toBe(false);
  });

  it('keeps one row open at a time', async () => {
    await act(async () => link('Change email')?.click());
    expect(isOpen('Change email')).toBe(true);

    await act(async () => link('Change')?.click());
    expect(isOpen('Change')).toBe(true);
    expect(isOpen('Change email')).toBe(false);
  });

  it('closes the open row from its own link, now a caret', async () => {
    await act(async () => link('Change email')?.click());
    const opened = link('Change email');
    expect(opened?.getAttribute('aria-label')).toBe('Close: Change email');

    await act(async () => opened?.click());
    expect(isOpen('Change email')).toBe(false);
  });
});
