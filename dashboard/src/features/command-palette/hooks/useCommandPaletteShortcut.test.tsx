import { vi } from 'vitest';
import { useCommandPaletteShortcut } from '@/features/command-palette/hooks/useCommandPaletteShortcut';
import { renderHook } from '@/tests/testUtils';

describe('useCommandPaletteShortcut', () => {
  it('ignores shortcuts while an editable element is active', () => {
    const onToggle = vi.fn();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    renderHook(() => useCommandPaletteShortcut({ open: false, onToggle }));

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
    );

    expect(onToggle).not.toHaveBeenCalled();

    input.remove();
  });
});
