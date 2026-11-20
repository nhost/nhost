import type { Ref } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { colors, fontSize, radius } from '@/theme';

/**
 * A text field. Android names it after the `Label` its `aria-labelledby`
 * points at. iOS ignores that prop, so it reads `label` instead; Android does
 * not, since there `label` would become a content description, which an
 * editable field should not carry.
 */
function Input({
  style,
  invalid,
  label,
  editable = true,
  ...props
}: TextInputProps & {
  label: string;
  'aria-labelledby': string;
  invalid?: boolean;
  ref?: Ref<TextInputInstance>;
}) {
  return (
    <TextInput
      accessibilityLabel={Platform.OS === 'ios' ? label : undefined}
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      keyboardAppearance="dark"
      editable={editable}
      style={[
        styles.input,
        invalid && styles.invalid,
        !editable && styles.disabled,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.input,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: colors.foreground,
    fontSize: fontSize.base,
  },
  invalid: {
    borderColor: colors.destructive,
  },
  disabled: {
    opacity: 0.5,
  },
});

export { Input };
