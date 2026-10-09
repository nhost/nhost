import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntentSwitch } from '@/signin/IntentSwitch';

// The component is called as a plain function, which runs its hooks only
// because each one is mocked here, so nothing needs a device to render it.
vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));
vi.mock('@/components/ui/Button', () => ({ Button: 'Button' }));

const go = { push: vi.fn(), replace: vi.fn(), backTo: vi.fn() };
const params = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock('@/lib/navigation', () => ({
  useGo: () => go,
  useParams: () => params.value,
}));

type Rendered = ReactElement<{
  children: [ReactElement<{ children: string }>, Switch];
}>;
type Switch = ReactElement<{ children: string; onPress: () => void }>;

function rendered(): { prompt: string; button: Switch } {
  const [prompt, button] = (IntentSwitch() as Rendered).props.children;

  return { prompt: prompt.props.children, button };
}

describe('IntentSwitch', () => {
  beforeEach(() => {
    go.replace.mockClear();
  });

  // A protected screen sends a user here with `next` and no intent, so the
  // screen opens on sign up. Switching to sign in has to keep `next`, or
  // signing in lands on the home screen instead of the one they asked for.
  it('offers sign in from sign up, keeping next', () => {
    params.value = { next: '/protected' };

    const { prompt, button } = rendered();
    button.props.onPress();

    expect(prompt).toBe('Already have an account?');
    expect(button.props.children).toBe('Sign in');
    expect(go.replace).toHaveBeenCalledWith({
      pathname: '/signin',
      params: { next: '/protected', intent: 'sign-in' },
    });
  });

  it('offers sign up from sign in, keeping next', () => {
    params.value = { next: '/protected', intent: 'sign-in' };

    const { prompt, button } = rendered();
    button.props.onPress();

    expect(prompt).toBe('New here?');
    expect(button.props.children).toBe('Create an account');
    expect(go.replace).toHaveBeenCalledWith({
      pathname: '/signin',
      params: { next: '/protected' },
    });
  });

  it('switches on the bare screen without a next', () => {
    params.value = {};

    rendered().button.props.onPress();

    expect(go.replace).toHaveBeenCalledWith({
      pathname: '/signin',
      params: { intent: 'sign-in' },
    });
  });
});
