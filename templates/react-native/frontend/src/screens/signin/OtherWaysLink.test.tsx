import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import OtherWaysLink from '@/screens/signin/OtherWaysLink';

// Only the count is read, so the entries name no method, and deleting a
// method leaves nothing here that names it.
const mockListed = { methods: [] as object[], buttons: [] as object[] };

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

const routes = {
  index: () => <OtherWaysLink query="?intent=sign-in" />,
  'signin/index': () => <Text>sign-in list</Text>,
};

beforeEach(() => {
  mockListed.methods = [{}, {}];
  mockListed.buttons = [];
});

describe('OtherWaysLink', () => {
  it('goes back to the list, keeping the query', async () => {
    await renderRouter(routes);

    await fireEvent.press(
      screen.getByRole('link', { name: 'Other ways to sign in' }),
    );

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ intent: 'sign-in' });
  });

  // A project may keep a single method, and then there is nowhere else to go.
  it('renders nothing when there is only one method', async () => {
    mockListed.methods = [{}];

    await renderRouter(routes);

    expect(screen.queryByRole('link')).toBeNull();
  });
});
