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
    const onShortcut = vi.fn();
    renderHook(() => useGlobalKeyShortcut({ key: 'F', onShortcut }));

    const event = dispatchShortcut('f', options);

    expect(onShortcut).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    { name: 'without Meta or Control', key: 'f', options: {} },
    { name: 'with a different key', key: 'g', options: { metaKey: true } },
  ])('ignores events $name without consulting policy', ({ key, options }) => {
    const onShortcut = vi.fn();
    const shouldHandle = vi.fn(() => true);
    renderHook(() =>
      useGlobalKeyShortcut({ key: 'f', onShortcut, shouldHandle }),
    );

    const event = dispatchShortcut(key, options);

    expect(shouldHandle).not.toHaveBeenCalled();
    expect(onShortcut).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    'input',
    'textarea',
    'select',
    'contenteditable',
  ])('ignores shortcuts from a %s by default', (elementType) => {
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

    const onShortcut = vi.fn();
    renderHook(() => useGlobalKeyShortcut({ key: 'f', onShortcut }));

    const event = dispatchShortcut('f', { ctrlKey: true });

    expect(onShortcut).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    element.remove();
  });

  it('handles an editable shortcut when custom policy accepts it', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const onShortcut = vi.fn();
    const shouldHandle = vi.fn(() => true);
    renderHook(() =>
      useGlobalKeyShortcut({ key: 'f', onShortcut, shouldHandle }),
    );

    const event = dispatchShortcut('f', { metaKey: true });

    expect(shouldHandle).toHaveBeenCalledWith({
      event,
      activeElement: input,
      isEditable: true,
    });
    expect(onShortcut).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    input.remove();
  });

  it('rejects a non-editable shortcut when custom policy declines it', () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const onShortcut = vi.fn();
    const shouldHandle = vi.fn(() => false);
    renderHook(() =>
      useGlobalKeyShortcut({ key: 'f', onShortcut, shouldHandle }),
    );

    const event = dispatchShortcut('f', { ctrlKey: true });

    expect(shouldHandle).toHaveBeenCalledWith({
      event,
      activeElement: button,
      isEditable: false,
    });
    expect(onShortcut).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    button.remove();
  });

  it('removes the listener on unmount', () => {
    const onShortcut = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalKeyShortcut({ key: 'f', onShortcut }),
    );
    unmount();

    const event = dispatchShortcut('f', { ctrlKey: true });

    expect(onShortcut).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
