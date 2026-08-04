import { vi } from 'vitest';
import TextWithTooltip from '@/features/orgs/projects/common/components/TextWithTooltip/TextWithTooltip';
import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

function mockTextDimensions(dimensions: {
  scrollHeight: number;
  clientHeight: number;
}) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    () => dimensions.scrollHeight,
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => dimensions.clientHeight,
  );
}

describe('TextWithTooltip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not add a tab stop when max-lines text is not truncated', async () => {
    mockTextDimensions({ scrollHeight: 24, clientHeight: 24 });

    render(<TextWithTooltip text="Complete value" maxLines={3} />);

    const text = screen.getByText('Complete value');
    await waitFor(() => expect(text).not.toHaveAttribute('tabindex'));
    expect(text).not.toHaveClass('focus-visible:ring-2');
  });

  it('opens the complete max-lines value in a tooltip on keyboard focus', async () => {
    mockTextDimensions({ scrollHeight: 72, clientHeight: 24 });
    const user = new TestUserEvent();

    render(<TextWithTooltip text="Complete truncated value" maxLines={3} />);

    const trigger = screen.getByText('Complete truncated value');
    await waitFor(() => expect(trigger).toHaveAttribute('tabindex', '0'));
    expect(trigger).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
    );

    await user.keyboard('{Tab}');

    expect(trigger).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(
      within(tooltip).getByText('Complete truncated value'),
    ).toBeInTheDocument();
  });

  it('remeasures when changed text becomes truncated without a resize callback', async () => {
    const dimensions = { scrollHeight: 24, clientHeight: 24 };
    mockTextDimensions(dimensions);
    const user = new TestUserEvent();
    const { rerender } = render(
      <TextWithTooltip text="Short value" maxLines={3} />,
    );

    const initialText = screen.getByText('Short value');
    await waitFor(() => expect(initialText).not.toHaveAttribute('tabindex'));

    dimensions.scrollHeight = 72;
    rerender(<TextWithTooltip text="A newly truncated value" maxLines={3} />);

    const updatedText = screen.getByText('A newly truncated value');
    await waitFor(() => expect(updatedText).toHaveAttribute('tabindex', '0'));

    await user.keyboard('{Tab}');

    expect(updatedText).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(
      within(tooltip).getByText('A newly truncated value'),
    ).toBeInTheDocument();
  });

  it('remeasures when changed text stops being truncated without a resize callback', async () => {
    const dimensions = { scrollHeight: 72, clientHeight: 24 };
    mockTextDimensions(dimensions);
    const user = new TestUserEvent();
    const { rerender } = render(
      <TextWithTooltip text="An initially truncated value" maxLines={3} />,
    );

    const initialText = screen.getByText('An initially truncated value');
    await waitFor(() => expect(initialText).toHaveAttribute('tabindex', '0'));

    await user.keyboard('{Tab}');

    expect(initialText).toHaveFocus();
    expect(
      within(await screen.findByRole('tooltip')).getByText(
        'An initially truncated value',
      ),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(),
    );
    initialText.blur();

    dimensions.scrollHeight = 24;
    rerender(<TextWithTooltip text="Short value" maxLines={3} />);

    const updatedText = screen.getByText('Short value');
    await waitFor(() => expect(updatedText).not.toHaveAttribute('tabindex'));

    await user.keyboard('{Tab}');

    expect(updatedText).not.toHaveFocus();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
