// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteAccountSetting from '@/app/account/DeleteAccountSetting';

const deleteAccount = vi.hoisted(() => vi.fn());

vi.mock('@/app/account/actions', () => ({ deleteAccount }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

const dialog = (): HTMLDialogElement | null =>
  container.querySelector('dialog');

const confirmButton = (): HTMLButtonElement | null =>
  dialog()?.querySelector('button[type="submit"]') ?? null;

async function open(): Promise<void> {
  await act(async () =>
    container.querySelector<HTMLButtonElement>('li > button')?.click(),
  );
}

async function type(value: string): Promise<void> {
  const input = dialog()?.querySelector('input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(): Promise<void> {
  await act(async () =>
    dialog()
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

describe('delete account setting', () => {
  beforeEach(async () => {
    deleteAccount.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    router = createMemoryRouter(
      [
        { path: '/', element: <p>home</p> },
        { path: '/account', element: <DeleteAccountSetting /> },
      ],
      { initialEntries: ['/account'] },
    );
    await act(async () => root.render(<RouterProvider router={router} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('waits for the word to be typed', async () => {
    await open();
    expect(confirmButton()?.disabled).toBe(true);

    await type('delet');
    expect(confirmButton()?.disabled).toBe(true);
    await submit();
    expect(deleteAccount).not.toHaveBeenCalled();

    await type('delete');
    expect(confirmButton()?.disabled).toBe(false);
  });

  it('deletes once confirmed and leaves the page', async () => {
    deleteAccount.mockResolvedValueOnce({ success: true });

    await open();
    await type('delete');
    await submit();

    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/');
  });
});
