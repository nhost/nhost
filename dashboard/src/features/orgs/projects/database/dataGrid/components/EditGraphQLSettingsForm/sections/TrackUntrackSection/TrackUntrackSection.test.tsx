import { vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import TrackUntrackSection from './TrackUntrackSection';

describe('TrackUntrackSection', () => {
  it('shows "Tracked in GraphQL" text and "Untrack" button when tracked', () => {
    render(
      <TrackUntrackSection
        isTracked
        isPending={false}
        onTrackToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('Tracked in GraphQL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Untrack' })).toBeInTheDocument();
  });

  it('shows "Not tracked in GraphQL" text and "Track" button when untracked', () => {
    render(
      <TrackUntrackSection
        isTracked={false}
        isPending={false}
        onTrackToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('Not tracked in GraphQL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track' })).toBeInTheDocument();
  });

  it('calls onTrackToggle when button is clicked', async () => {
    const onTrackToggle = vi.fn();

    render(
      <TrackUntrackSection
        isTracked
        isPending={false}
        onTrackToggle={onTrackToggle}
      />,
    );

    screen.getByRole('button', { name: 'Untrack' }).click();

    expect(onTrackToggle).toHaveBeenCalledOnce();
  });

  it('disables the button when disabled prop is true', () => {
    render(
      <TrackUntrackSection
        isTracked
        isPending={false}
        onTrackToggle={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: 'Untrack' })).toBeDisabled();
  });

  it('disables the button when isPending is true', () => {
    render(<TrackUntrackSection isTracked isPending onTrackToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Untrack' })).toBeDisabled();
  });
});
