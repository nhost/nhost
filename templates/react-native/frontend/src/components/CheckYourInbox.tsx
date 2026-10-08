import { Linking, Text } from 'react-native';
import { CardTitle } from '@/components/ui/Card';
import { localMailboxURL } from '@/lib/nhost/env';

const TEXT = 'Check your inbox';

/**
 * Titles a state that is waiting on an email, and opens the local mailbox.
 *
 * Several of the auth flows get as far as "check your inbox", and against a
 * local backend that inbox is Mailhog rather than a real one. Without this a
 * developer trying the template has to know that, find the URL and open it by
 * hand, at exactly the point the flow is supposed to continue.
 *
 * The words only become a link while that mailbox exists. `localMailboxURL()`
 * returns null once the app targets a real project, and then they stay plain
 * text: the email went to the visitor's own inbox, so a link would be a lie
 * about where to find it. It reads that itself rather than taking it as a
 * prop: `EXPO_PUBLIC_*` is inlined into the bundle, so there is no server half
 * to resolve it on the way through.
 *
 * The inner `Text` inherits the title's styling, which is what keeps the two
 * states looking the same apart from the underline.
 */
export function CheckYourInbox() {
  const url = localMailboxURL();

  if (!url) {
    return <CardTitle>{TEXT}</CardTitle>;
  }

  return (
    <CardTitle>
      <Text
        accessibilityRole="link"
        className="underline"
        onPress={() => void Linking.openURL(url)}
      >
        {TEXT}
      </Text>
    </CardTitle>
  );
}
