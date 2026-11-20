import {
  fireEvent,
  renderRouter,
  screen,
  within,
} from 'expo-router/testing-library';
import { Text } from 'react-native';
import SignIn from '@/screens/signin/page';

// No real method is listed, so deleting one leaves nothing here that names it.
const mockListed = {
  methods: [] as object[],
  buttons: [] as ((props: {
    destination: string;
    lastUsed: string | null;
  }) => React.ReactElement)[],
};
const mockLastUsed = { current: null as string | null };

// Read when a screen renders: the factory runs before this file's constants
// are set.
jest.mock('@/screens/signin/methods', () => ({
  get methods() {
    return mockListed.methods;
  },
  get buttons() {
    return mockListed.buttons;
  },
}));
jest.mock('@/screens/signin/lastUsed', () => ({
  lastUsedSignIn: () => mockLastUsed.current,
}));

const routes = {
  'signin/index': SignIn,
  'auth/a-method/index': () => <Text>a method</Text>,
  'auth/b-method/index': () => <Text>b method</Text>,
};

beforeEach(() => {
  mockListed.methods = [];
  mockListed.buttons = [];
  mockLastUsed.current = null;
});

describe('sign-in screen', () => {
  // A protected screen sends a visitor here with `next` and no intent, so the
  // screen opens on sign up.
  it('offers sign in from sign up, keeping next', async () => {
    await renderRouter(routes, { initialUrl: '/signin?next=%2Fprotected' });

    expect(
      screen.getByRole('heading', { name: 'Create an account' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Already have an account\?/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Sign in' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({
      next: '/protected',
      intent: 'sign-in',
    });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('opens a method with the same next and intent', async () => {
    mockListed.methods = [
      { href: '/auth/a-method', title: 'A method', description: '' },
    ];
    await renderRouter(routes, {
      initialUrl: '/signin?next=%2Fprotected&intent=sign-in',
    });

    await fireEvent.press(screen.getByRole('link', { name: /A method/ }));

    expect(screen).toHavePathname('/auth/a-method');
    expect(screen).toHaveSearchParams({
      next: '/protected',
      intent: 'sign-in',
    });
  });

  it('marks the way the visitor last signed in', async () => {
    mockListed.methods = [
      { href: '/auth/a-method', title: 'A method', description: '' },
      { href: '/auth/b-method', title: 'B method', description: '' },
    ];
    mockListed.buttons = [
      ({ lastUsed }) => <Text>{`buttons told ${lastUsed}`}</Text>,
    ];
    mockLastUsed.current = '/auth/b-method';

    await renderRouter(routes, { initialUrl: '/signin' });

    expect(
      within(screen.getByRole('link', { name: /B method/ })).getByText(
        'Last used',
      ),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Last used')).toHaveLength(1);
    expect(screen.getByText('or')).toBeOnTheScreen();
    expect(screen.getByText('buttons told /auth/b-method')).toBeOnTheScreen();
  });
});
