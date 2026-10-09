import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OtherWaysLink } from '@/signin/OtherWaysLink';

// The component is called as a plain function, which runs its hooks only
// because each one is mocked here, so nothing needs a device to render it.
vi.mock('react-native', () => ({ Text: 'Text' }));

const go = { push: vi.fn(), replace: vi.fn(), backTo: vi.fn() };

vi.mock('@/lib/navigation', () => ({
  useGo: () => go,
  useParams: () => ({ next: '/protected', intent: 'sign-in' }),
}));

// Two of anything: the count is all the link reads, and a scaffold with one
// method would otherwise hide it.
vi.mock('@/signin/methods', () => ({ methods: [{}, {}] }));

describe('OtherWaysLink', () => {
  it('goes back to sign-in carrying next and intent', () => {
    const link = OtherWaysLink() as ReactElement<{ onPress: () => void }>;

    link.props.onPress();

    expect(go.backTo).toHaveBeenCalledWith({
      pathname: '/signin',
      params: { next: '/protected', intent: 'sign-in' },
    });
    expect(go.push).not.toHaveBeenCalled();
  });
});
