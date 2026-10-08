import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { useGo } from '@/lib/navigation';
import type { Intent } from '@/signin/intent';
import { methods } from '@/signin/methods';
import { signInRoute } from '@/signin/route';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

/**
 * Lists the ways to sign in. Each method is a screen of its own under
 * `/auth/<method>`; this screen only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the user was going when a protected screen sent them here,
 * and `intent` is whether they came to sign up or to sign in. Both are passed
 * along to whichever method they pick: one so that screen can finish the trip,
 * the other so a form opens on the right mode.
 */

// What the screen says depends on why the user is here. Neither heading names
// a method, so both survive any selection.
const copy: Record<Intent, { title: string; description: string }> = {
  'sign-up': {
    title: 'Create an account',
    description: 'Choose how you want to sign up.',
  },
  'sign-in': {
    title: 'Sign in',
    description: 'Choose how you want to sign in.',
  },
};

export default function SignIn() {
  const go = useGo();
  const next = useNext();
  const intent = useIntent();

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>{copy[intent].title}</CardTitle>
          <CardDescription>{copy[intent].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {methods.map((method) => (
            <Pressable
              key={method.href}
              accessibilityRole="button"
              className="rounded-lg border border-neutral-200 p-4 active:bg-neutral-100"
              onPress={() => go.push(signInRoute(method.href, next, intent))}
            >
              <View className="gap-1">
                <Text className="font-medium text-neutral-900">
                  {method.title}
                </Text>
                <Text className="text-neutral-500 text-sm">
                  {method.description}
                </Text>
              </View>
            </Pressable>
          ))}
        </CardContent>
      </Card>
    </Screen>
  );
}
