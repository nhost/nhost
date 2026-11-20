import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fontSize } from '@/theme';

/**
 * A field's label. Give it a `nativeID`, and the `Input` the same id in
 * `aria-labelledby` and the same text in `label`, together the native
 * stand-in for `htmlFor`.
 */
function Label({ style, ...props }: TextProps & { nativeID: string }) {
  return <Text style={[styles.label, style]} {...props} />;
}

const styles = StyleSheet.create({
  label: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});

export { Label };
