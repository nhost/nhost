import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/index';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInRoute } from '@/signin/route';

// Here rather than beside the screen: every file under `src/app` is a route,
// under either navigation system, and a test there would be one too.

// The screen is called as a plain function, which runs its hooks only because
// each one is mocked here, so nothing needs a device to render it.
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  View: 'View',
}));
vi.mock('@/components/Screen', () => ({ Screen: 'Screen' }));
vi.mock('@/components/ui/Button', () => ({ Button: 'Button' }));
vi.mock('@/components/ui/Card', () => ({
  Card: 'Card',
  CardContent: 'CardContent',
  CardDescription: 'CardDescription',
  CardHeader: 'CardHeader',
  CardTitle: 'CardTitle',
}));

const go = { push: vi.fn(), replace: vi.fn(), backTo: vi.fn() };

vi.mock('@/lib/navigation', () => ({ useGo: () => go }));
vi.mock('@/lib/nhost/AuthProvider', () => ({
  useAuth: () => ({ session: null, isLoading: false }),
}));

type Pressable = ReactElement<{ children: ReactNode; onPress: () => void }>;

function buttons(node: ReactNode): Pressable[] {
  if (Array.isArray(node)) {
    return node.flatMap(buttons);
  }

  if (!node || typeof node !== 'object' || !('props' in node)) {
    return [];
  }

  const element = node as Pressable;

  return element.type === 'Button'
    ? [element]
    : buttons(element.props.children);
}

describe('Home', () => {
  // These links are where the intent starts. Built any other way, they would
  // be left behind by a change to `route.ts` and open on the default mode.
  it('opens each mode through signInRoute', () => {
    for (const button of buttons(Home())) {
      button.props.onPress();
    }

    expect(go.push.mock.calls).toEqual([
      [signInRoute('/signin', DEFAULT_DESTINATION, 'sign-up')],
      [signInRoute('/signin', DEFAULT_DESTINATION, 'sign-in')],
    ]);
  });
});
