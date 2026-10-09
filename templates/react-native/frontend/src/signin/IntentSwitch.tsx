import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useGo } from '@/lib/navigation';
import type { Intent } from '@/signin/intent';
import { signInRoute } from '@/signin/route';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

const switchTo: Record<
  Intent,
  { intent: Intent; prompt: string; label: string }
> = {
  'sign-up': {
    intent: 'sign-in',
    prompt: 'Already have an account?',
    label: 'Sign in',
  },
  'sign-in': {
    intent: 'sign-up',
    prompt: 'New here?',
    label: 'Create an account',
  },
};

/**
 * Offers the sign-in screen's other intent, keeping `next`.
 *
 * A protected screen sends a user here without an intent, so the screen opens
 * on sign up whether or not they have an account. This is how someone who does
 * have one switches without losing the screen they were going to.
 *
 * It takes the place of the screen rather than stacking another copy of it,
 * since the switch only changes what the same screen says.
 */
export function IntentSwitch() {
  const go = useGo();
  const next = useNext();
  const intent = useIntent();
  const other = switchTo[intent];

  return (
    <View className="flex-row flex-wrap items-center gap-x-1">
      <Text className="text-neutral-500 text-sm">{other.prompt}</Text>
      <Button
        variant="link"
        size="link"
        onPress={() => go.replace(signInRoute('/signin', next, other.intent))}
      >
        {other.label}
      </Button>
    </View>
  );
}
