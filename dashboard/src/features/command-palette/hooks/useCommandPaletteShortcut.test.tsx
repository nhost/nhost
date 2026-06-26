import { vi } from 'vitest';
import { useCommandPaletteShortcut } from '@/features/command-palette/hooks/useCommandPaletteShortcut';
import { renderHook } from '@/tests/testUtils';

describe('useCommandPaletteShortcut', () => {
  it('calls onToggle for command/control K', () => {
    const onToggle = vi.fn();

    renderHook(() => useCommandPaletteShortcut({ onToggle }));

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'K', ctrlKey: true }),
    );

    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('ignores shortcuts while an editable element is active', () => {
    const onToggle = vi.fn();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    renderHook(() => useCommandPaletteShortcut({ onToggle }));

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
    );

    expect(onToggle).not.toHaveBeenCalled();

    input.remove();
  });
});
