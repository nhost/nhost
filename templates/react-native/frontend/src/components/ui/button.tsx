import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, radius } from '@/theme';

type Variant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

type Size = 'default' | 'sm' | 'lg' | 'icon';

const labelColor: Record<Variant, string> = {
  default: colors.primaryForeground,
  destructive: '#ffffff',
  outline: colors.foreground,
  secondary: colors.foreground,
  ghost: colors.foreground,
  link: colors.primary,
};

/** A button labelled `title`, after any icon passed as `children`. */
function Button({
  title,
  variant = 'default',
  size = 'default',
  disabled,
  style,
  children,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  title?: string;
  variant?: Variant;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variants[variant],
        sizes[size],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {children}
      {title ? (
        <Text
          style={[
            styles.label,
            { color: labelColor[variant] },
            variant === 'link' && styles.linkLabel,
          ]}
        >
          {title}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  linkLabel: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variants = StyleSheet.create({
  default: { backgroundColor: colors.primary },
  destructive: { backgroundColor: colors.destructive },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.input,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondary: { backgroundColor: colors.secondary },
  ghost: {},
  link: {},
});

const sizes = StyleSheet.create({
  default: { minHeight: 36, paddingHorizontal: 16, paddingVertical: 8 },
  sm: { minHeight: 32, paddingHorizontal: 12, gap: 6 },
  lg: { minHeight: 40, paddingHorizontal: 24 },
  icon: { width: 36, height: 36 },
});

export { Button };
