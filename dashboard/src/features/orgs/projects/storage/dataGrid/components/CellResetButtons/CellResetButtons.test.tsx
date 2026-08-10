import { vi } from 'vitest';
import { fireEvent, render, screen, TestUserEvent } from '@/tests/testUtils';
import CellResetButtons from './CellResetButtons';

const focusNextCell = vi.fn();

vi.mock(
  '@/features/orgs/projects/storage/dataGrid/components/DataGridCell',
  () => ({
    useDataGridCell: () => ({ focusNextCell }),
  }),
);

beforeEach(() => {
  focusNextCell.mockReset();
});

describe('CellResetButtons', () => {
  describe('rendering and click behavior', () => {
    it('renders both NULL and DEFAULT when isNullable and hasDefault are true', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'NULL' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'DEFAULT' }),
      ).toBeInTheDocument();
    });

    it('renders only NULL when only isNullable is true', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault={false}
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'NULL' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'DEFAULT' }),
      ).not.toBeInTheDocument();
    });

    it('renders only DEFAULT when only hasDefault is true', () => {
      render(
        <CellResetButtons
          isNullable={false}
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: 'NULL' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'DEFAULT' }),
      ).toBeInTheDocument();
    });

    it('does not render NULL when isNullable is undefined', () => {
      render(
        <CellResetButtons
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: 'NULL' }),
      ).not.toBeInTheDocument();
    });

    it('calls onSetNull once when NULL button is clicked', async () => {
      const user = new TestUserEvent();
      const onSetNull = vi.fn();

      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={onSetNull}
          onSetDefault={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'NULL' }));

      expect(onSetNull).toHaveBeenCalledTimes(1);
    });

    it('calls onSetDefault once when DEFAULT button is clicked', async () => {
      const user = new TestUserEvent();
      const onSetDefault = vi.fn();

      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={onSetDefault}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'DEFAULT' }));

      expect(onSetDefault).toHaveBeenCalledTimes(1);
    });

    it('prevents default on mousedown so the editor input keeps focus', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      const nullButton = screen.getByRole('button', { name: 'NULL' });
      const wasNotPrevented = fireEvent.mouseDown(nullButton);

      expect(wasNotPrevented).toBe(false);
    });
  });

  describe('keyboard behavior', () => {
    it('does not advance to the next cell when Tab is pressed on NULL while DEFAULT is also rendered', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      const nullButton = screen.getByRole('button', { name: 'NULL' });
      const wasNotPrevented = fireEvent.keyDown(nullButton, { key: 'Tab' });

      expect(focusNextCell).not.toHaveBeenCalled();
      expect(wasNotPrevented).toBe(true);
    });

    it('advances to the next cell when Tab is pressed on NULL and DEFAULT is not rendered', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault={false}
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      const nullButton = screen.getByRole('button', { name: 'NULL' });
      const wasNotPrevented = fireEvent.keyDown(nullButton, { key: 'Tab' });

      expect(focusNextCell).toHaveBeenCalledTimes(1);
      expect(wasNotPrevented).toBe(false);
    });

    it('advances to the next cell when Tab is pressed on DEFAULT', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      const defaultButton = screen.getByRole('button', { name: 'DEFAULT' });
      const wasNotPrevented = fireEvent.keyDown(defaultButton, { key: 'Tab' });

      expect(focusNextCell).toHaveBeenCalledTimes(1);
      expect(wasNotPrevented).toBe(false);
    });

    it('does not advance to the next cell when Shift+Tab is pressed', () => {
      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      const nullButton = screen.getByRole('button', { name: 'NULL' });
      const defaultButton = screen.getByRole('button', { name: 'DEFAULT' });

      const nullNotPrevented = fireEvent.keyDown(nullButton, {
        key: 'Tab',
        shiftKey: true,
      });
      const defaultNotPrevented = fireEvent.keyDown(defaultButton, {
        key: 'Tab',
        shiftKey: true,
      });

      expect(focusNextCell).not.toHaveBeenCalled();
      expect(nullNotPrevented).toBe(true);
      expect(defaultNotPrevented).toBe(true);
    });

    it.each([
      'Enter',
      'Escape',
      'ArrowDown',
    ])('does not advance to the next cell when %s is pressed', (key) => {
      render(
        <CellResetButtons
          isNullable
          hasDefault
          onSetNull={vi.fn()}
          onSetDefault={vi.fn()}
        />,
      );

      fireEvent.keyDown(screen.getByRole('button', { name: 'NULL' }), {
        key,
      });
      fireEvent.keyDown(screen.getByRole('button', { name: 'DEFAULT' }), {
        key,
      });

      expect(focusNextCell).not.toHaveBeenCalled();
    });

    it('stops propagation of the Tab keydown so the cell-level handler does not run', () => {
      const onDocumentKeyDown = vi.fn();
      document.addEventListener('keydown', onDocumentKeyDown);

      try {
        render(
          <CellResetButtons
            isNullable
            hasDefault
            onSetNull={vi.fn()}
            onSetDefault={vi.fn()}
          />,
        );

        fireEvent.keyDown(screen.getByRole('button', { name: 'NULL' }), {
          key: 'Tab',
        });
        fireEvent.keyDown(screen.getByRole('button', { name: 'DEFAULT' }), {
          key: 'Tab',
        });

        expect(onDocumentKeyDown).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener('keydown', onDocumentKeyDown);
      }
    });
  });
});
