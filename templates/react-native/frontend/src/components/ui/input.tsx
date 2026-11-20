import type { Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { colors, fontSize, radius } from '@/theme';

function Input({
  style,
  invalid,
  editable = true,
  ...props
}: TextInputProps & { invalid?: boolean; ref?: Ref<TextInputInstance> }) {
  return (
    <TextInput
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
