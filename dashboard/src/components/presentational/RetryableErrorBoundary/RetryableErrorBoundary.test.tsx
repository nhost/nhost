import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { render, screen } from '@/tests/testUtils';

const error = new Error('Project failed to load');

function Child({ fails }: { fails: boolean }) {
  if (fails) {
    throw error;
  }
  return <p>Project loaded</p>;
}

interface HarnessProps {
  fails: boolean;
  resetKey: string;
}

function Harness({ fails, resetKey }: HarnessProps) {
  return (
    <RetryableErrorBoundary resetKeys={[resetKey]}>
      <Child fails={fails} />
    </RetryableErrorBoundary>
  );
}

describe('RetryableErrorBoundary', () => {
  it('resets its error when a caller-provided reset key changes', () => {
    const { rerender } = render(<Harness fails resetKey="project-a" />);
    expect(screen.getByText(error.message)).toBeVisible();

    rerender(<Harness fails={false} resetKey="project-a" />);
    expect(screen.getByText(error.message)).toBeVisible();

    rerender(<Harness fails={false} resetKey="project-b" />);
    expect(screen.getByText('Project loaded')).toBeVisible();
  });
});
