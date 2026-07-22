import { vi } from 'vitest';
import { useGlobalSearchShortcut } from '@/features/orgs/projects/logs/components/LogsBody/useGlobalSearchShortcut';
import { renderHook } from '@/tests/testUtils';

function dispatchFindShortcut(
  key: string,
  options: Pick<KeyboardEventInit, 'ctrlKey' | 'metaKey'>,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

function setupTarget() {
  const target = document.createElement('input');
  document.body.append(target);
  const select = vi.spyOn(target, 'select');
  renderHook(() => useGlobalSearchShortcut({ targetRef: { current: target } }));
  return { target, select };
}

describe('useGlobalSearchShortcut', () => {
  it.each([
    { key: 'f', options: { metaKey: true } },
    { key: 'F', options: { ctrlKey: true } },
  ])('focuses and selects the search input for $key', ({ key, options }) => {
    const { target, select } = setupTarget();

    const event = dispatchFindShortcut(key, options);

    expect(document.activeElement).toBe(target);
    expect(select).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    target.remove();
  });

  it('handles the shortcut again when the search input is already focused', () => {
    const { target, select } = setupTarget();
    target.focus();

    const firstEvent = dispatchFindShortcut('f', { metaKey: true });
    const secondEvent = dispatchFindShortcut('F', { ctrlKey: true });

    expect(select).toHaveBeenCalledTimes(2);
    expect(firstEvent.defaultPrevented).toBe(true);
    expect(secondEvent.defaultPrevented).toBe(true);
    target.remove();
  });

  it('leaves native find available from another input', () => {
    const { target, select } = setupTarget();
    const otherInput = document.createElement('input');
    document.body.append(otherInput);
    otherInput.focus();

    const event = dispatchFindShortcut('f', { ctrlKey: true });

    expect(document.activeElement).toBe(otherInput);
    expect(select).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    otherInput.remove();
    target.remove();
  });
});
