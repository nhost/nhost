import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import SchemaSearchBar, { type SchemaSearchBarProps } from './SchemaSearchBar';

function renderSearchBar(props: Partial<SchemaSearchBarProps> = {}) {
  const handlers = {
    onTermChange: vi.fn(),
    onFind: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
  };

  const { rerender } = render(
    <SchemaSearchBar term="title" result={null} {...handlers} {...props} />,
  );

  return { ...handlers, rerender };
}

function getSearchBox() {
  return screen.getByRole('searchbox', { name: 'Search schema' });
}

describe('SchemaSearchBar', () => {
  describe('Enter', () => {
    it('searches when the term was not searched yet', async () => {
      const user = new TestUserEvent();
      const { onFind, onNext } = renderSearchBar();

      await user.click(getSearchBox());
      await user.keyboard('{Enter}');

      expect(onFind).toHaveBeenCalledTimes(1);
      expect(onNext).not.toHaveBeenCalled();
    });

    it('searches again when the last search had no matches', async () => {
      const user = new TestUserEvent();
      const { onFind, onNext } = renderSearchBar({
        result: { count: 0, index: 0 },
      });

      await user.click(getSearchBox());
      await user.keyboard('{Enter}');

      expect(onFind).toHaveBeenCalledTimes(1);
      expect(onNext).not.toHaveBeenCalled();
    });

    it('goes to the next match once there are matches', async () => {
      const user = new TestUserEvent();
      const { onFind, onNext, onPrevious } = renderSearchBar({
        result: { count: 2, index: 0 },
      });

      await user.click(getSearchBox());
      await user.keyboard('{Enter}');

      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onFind).not.toHaveBeenCalled();
      expect(onPrevious).not.toHaveBeenCalled();
    });

    it('goes to the previous match with Shift', async () => {
      const user = new TestUserEvent();
      const { onNext, onPrevious } = renderSearchBar({
        result: { count: 2, index: 0 },
      });

      await user.click(getSearchBox());
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      expect(onPrevious).toHaveBeenCalledTimes(1);
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  it('reports typed text', async () => {
    const user = new TestUserEvent();
    const { onTermChange } = renderSearchBar({ term: '' });

    await user.type(getSearchBox(), 'u');

    expect(onTermChange).toHaveBeenCalledWith('u');
  });

  describe('Find button', () => {
    it('searches on click', async () => {
      const user = new TestUserEvent();
      const { onFind } = renderSearchBar();

      await user.click(screen.getByRole('button', { name: 'Find' }));

      expect(onFind).toHaveBeenCalledTimes(1);
    });

    it.each(['', '   '])('is disabled for the term %j', (term) => {
      renderSearchBar({ term });

      expect(screen.getByRole('button', { name: 'Find' })).toBeDisabled();
    });
  });

  describe('clear button', () => {
    it('clears the term', async () => {
      const user = new TestUserEvent();
      const { onTermChange } = renderSearchBar();

      await user.click(screen.getByRole('button', { name: 'Clear search' }));

      expect(onTermChange).toHaveBeenCalledWith('');
    });

    it('is hidden when there is no term', () => {
      renderSearchBar({ term: '' });

      expect(
        screen.queryByRole('button', { name: 'Clear search' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('match summary', () => {
    it('is empty until the term is searched', () => {
      renderSearchBar();

      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('stays in the same live region when a result arrives', () => {
      const handlers = renderSearchBar();
      const status = screen.getByRole('status');

      handlers.rerender(
        <SchemaSearchBar
          term="title"
          result={{ count: 2, index: 0 }}
          onTermChange={handlers.onTermChange}
          onFind={handlers.onFind}
          onNext={handlers.onNext}
          onPrevious={handlers.onPrevious}
        />,
      );

      expect(screen.getByRole('status')).toBe(status);
      expect(status).toHaveTextContent('1 of 2 matches');
    });

    it.each([
      [{ count: 0, index: 0 }, 'No matches'],
      [{ count: 1, index: 0 }, '1 of 1 match'],
      [{ count: 5, index: 1 }, '2 of 5 matches'],
    ])('shows %j as %s', (result, summary) => {
      renderSearchBar({ result });

      expect(screen.getByText(summary)).toBeInTheDocument();
    });
  });
});
