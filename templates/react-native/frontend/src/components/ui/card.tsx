import {
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';
import { colors, fontSize, inset, radius } from '@/theme';

function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

function CardHeader({ style, ...props }: ViewProps) {
  return <View style={[styles.header, style]} {...props} />;
}

function CardTitle({ style, ...props }: TextProps) {
  return <Text role="heading" style={[styles.title, style]} {...props} />;
}

function CardDescription({ style, ...props }: TextProps) {
  return <Text style={[styles.description, style]} {...props} />;
}

function CardContent({ style, ...props }: ViewProps) {
  return <View style={[styles.content, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    gap: 20,
    paddingVertical: 20,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  header: {
    gap: 6,
    paddingHorizontal: inset.card,
  },
  title: {
    color: colors.foreground,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  description: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  content: {
    paddingHorizontal: inset.card,
  },
});

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
