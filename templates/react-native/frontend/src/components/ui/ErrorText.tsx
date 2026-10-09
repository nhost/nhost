import { useEffect } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

/**
 * What a form says when a request came back with something to report. A
 * screen reader announces it when it appears and whenever its message changes,
 * the native equivalent of the web templates' `role="alert"`. That takes an
 * explicit announcement: `accessibilityLiveRegion` is Android only. Clear the
 * error before retrying, or the same failure twice is announced only once.
 *
 * Pass `announce={false}` where the message is already announced elsewhere.
 */
export function ErrorText({
  children,
  announce = true,
}: {
  children: string;
  announce?: boolean;
}) {
  useEffect(() => {
    if (announce && children) {
      AccessibilityInfo.announceForAccessibility(children);
    }
  }, [announce, children]);

  return <Text className="text-red-600 text-sm">{children}</Text>;
}
