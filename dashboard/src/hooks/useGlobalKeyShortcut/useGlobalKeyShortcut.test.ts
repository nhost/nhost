import { vi } from 'vitest';
import { useGlobalKeyShortcut } from '@/hooks/useGlobalKeyShortcut';
import { renderHook } from '@/tests/testUtils';

function dispatchShortcut(
  key: string,
  options: Pick<KeyboardEventInit, 'ctrlKey' | 'metaKey'> = {},
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

describe('useGlobalKeyShortcut', () => {
  it.each([
    { modifier: 'Meta', options: { metaKey: true } },
    { modifier: 'Control', options: { ctrlKey: true } },
  ])('handles $modifier shortcuts case-insensitively', ({ options }) => {
    const onTrigger = vi.fn();
    renderHook(() => useGlobalKeyShortcut({ key: 'F', onTrigger }));

    const event = dispatchShortcut('f', options);

    expect(onTrigger).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    { name: 'without Meta or Control', key: 'f', options: {} },
    { name: 'with a different key', key: 'g', options: { metaKey: true } },
  ])('ignores events $name', ({ key, options }) => {
    const onTrigger = vi.fn();
    renderHook(() => useGlobalKeyShortcut({ key: 'f', onTrigger }));

    const event = dispatchShortcut(key, options);

    expect(onTrigger).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    'input',
    'textarea',
    'select',
    'contenteditable',
  ])('ignores shortcuts from a %s', (elementType) => {
    const element =
      elementType === 'contenteditable'
        ? document.createElement('div')
        : document.createElement(elementType);
    if (elementType === 'contenteditable') {
      Object.defineProperty(element, 'isContentEditable', { value: true });
      element.tabIndex = 0;
    }
    document.body.append(element);
    element.focus();

    const onTrigger = vi.fn();
    renderHook(() => useGlobalKeyShortcut({ key: 'f', onTrigger }));

    const event = dispatchShortcut('f', { ctrlKey: true });

    expect(onTrigger).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    element.remove();
  });

  it('handles shortcuts from an editable allowed by the predicate', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const onTrigger = vi.fn();
    const isEditableAllowed = vi.fn(() => true);
    renderHook(() =>
      useGlobalKeyShortcut({ key: 'f', onTrigger, isEditableAllowed }),
    );

    const event = dispatchShortcut('f', { metaKey: true });

    expect(isEditableAllowed).toHaveBeenCalledWith(input);
    expect(onTrigger).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    input.remove();
  });

  it('removes the listener on unmount', () => {
    const onTrigger = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalKeyShortcut({ key: 'f', onTrigger }),
    );
    unmount();

    const event = dispatchShortcut('f', { ctrlKey: true });

    expect(onTrigger).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
