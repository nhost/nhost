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
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { methods } from '@/signin/methods';
import { useNext } from '@/signin/useNext';

/**
 * Lists the ways to sign in. Each method is a screen of its own under
 * `/auth/<method>`; this screen only links to them, from the data in
 * `methods.ts`, so deleting a method never breaks it.
 *
 * `next` is where the user was going when a protected screen sent them here.
 * It is passed along to whichever method they pick, so that screen can finish
 * the trip after signing them in.
 */
export default function SignIn() {
  const go = useGo();
  const next = useNext();
  const params = next === DEFAULT_DESTINATION ? undefined : { next };

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Choose how you want to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          {methods.map((method) => (
            <Pressable
              key={method.href}
              accessibilityRole="button"
              className="rounded-lg border border-neutral-200 p-4 active:bg-neutral-100"
              onPress={() =>
                go.push(
                  params ? { pathname: method.href, params } : method.href,
                )
              }
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
