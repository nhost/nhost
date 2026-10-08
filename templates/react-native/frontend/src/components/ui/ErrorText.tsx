import { Text } from 'react-native';

/**
 * What a form says when a request came back with something to report. It is a
 * live region so a screen reader announces it when it appears, which is the
 * native equivalent of the web templates' `role="alert"`.
 */
export function ErrorText({ children }: { children: string }) {
  return (
    <Text accessibilityLiveRegion="polite" className="text-red-600 text-sm">
      {children}
    </Text>
  );
}
