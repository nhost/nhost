import { StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from './theme';

/**
 * Common styles used across multiple components.
 * This promotes consistency and reduces code duplication.
 */

export const commonStyles = StyleSheet.create({
  // Layout styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  contentContainer: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.md,
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  // Card styles
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.medium,
  },

  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Button styles
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },

  buttonSecondary: {
    backgroundColor: colors.secondary,
  },

  buttonText: {
    color: colors.surface,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },

  // Text styles
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.sizes.xxl * typography.lineHeights.tight,
  },

  subtitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  bodyText: {
    fontSize: typography.sizes.md,
    color: colors.textLight,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },

  labelText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  valueText: {
    fontSize: typography.sizes.md,
    color: colors.textLight,
  },

  // Status text styles
  successText: {
    color: colors.success,
    fontWeight: typography.weights.semibold,
  },

  errorText: {
    color: colors.error,
    fontWeight: typography.weights.semibold,
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },

  // Form styles
  formField: {
    marginBottom: spacing.lg,
  },

  fieldGroup: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  // Session info styles
  sessionInfo: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },

  sessionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 2,
  },

  sessionValue: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontFamily: 'monospace',
  },

  // Utility styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  spaceBetween: {
    justifyContent: 'space-between',
  },

  alignCenter: {
    alignItems: 'center',
  },

  textCenter: {
    textAlign: 'center',
  },

  marginBottom: {
    marginBottom: spacing.md,
  },

  fullWidth: {
    width: '100%',
  },
});

// Specific component styles that might be reused
export const profileStyles = StyleSheet.create({
  profileItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  profileItemLast: {
    borderBottomWidth: 0,
  },
});

export const homeStyles = StyleSheet.create({
  welcomeCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.medium,
  },

  welcomeText: {
    fontSize: typography.sizes.lg,
    marginBottom: spacing.xl,
    textAlign: 'center',
    color: colors.text,
    lineHeight: typography.sizes.lg * typography.lineHeights.normal,
  },

  authMessage: {
    fontSize: typography.sizes.md,
    textAlign: 'center',
    color: colors.textLight,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },
});
