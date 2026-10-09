import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { useAuth } from '@/lib/nhost/AuthProvider';

/**
 * Says why the link or provider callback the user came back from did not sign
 * them in. It sits above every screen because that can be any of them: an
 * auth email or a provider comes back to wherever `next` said.
 *
 * A stack keeps the screens it passed through, so there is no single moment
 * the user leaves the one they arrived on. The notice goes when they dismiss
 * it, sign in, or come back from another link.
 *
 * Every screen in the stack renders this notice, so `setLinkError` announces
 * the message once rather than each of them.
 */
export function LinkErrorNotice() {
  const { linkError, setLinkError } = useAuth();

  if (!linkError) {
    return null;
  }

  return (
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-1">
        <ErrorText announce={false}>{linkError}</ErrorText>
      </View>
      <Button variant="link" size="link" onPress={() => setLinkError(null)}>
        Dismiss
      </Button>
    </View>
  );
}
