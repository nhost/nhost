import { Text } from 'react-native';
import { useGo } from '@/lib/navigation';
import { methods } from '@/signin/methods';
import { signInRoute } from '@/signin/route';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

/**
 * Sends the visitor back to the list of sign-in methods, when there is a list
 * worth going back to.
 *
 * `--auth-methods` can scaffold a single method, and `methods.ts` is the only
 * thing that knows how many there are. With one, the sign-in screen offers
 * nothing this one does not already show, so the link would promise choices
 * that do not exist.
 *
 * It reads `methods.ts` rather than naming any method, which is what keeps it
 * shared: deleting a method changes the count and nothing here.
 *
 * `next` and `intent` are read here rather than taken as props, so every
 * method screen gets a back link that remembers both without passing anything.
 * There is no server half on a device to resolve them on the way through.
 *
 * It goes back rather than forward: the sign-in screen is normally the one
 * beneath, and pushing another would leave two of it on the stack.
 */
export function OtherWaysLink() {
  const go = useGo();
  const next = useNext();
  const intent = useIntent();

  if (methods.length < 2) {
    return null;
  }

  return (
    <Text
      accessibilityRole="link"
      className="text-neutral-500 text-sm underline"
      onPress={() => go.backTo(signInRoute('/signin', next, intent))}
    >
      Other ways to sign in
    </Text>
  );
}
