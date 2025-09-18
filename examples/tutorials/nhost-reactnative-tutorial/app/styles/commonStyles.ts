import { StyleSheet } from "react-native";
import { borderRadius, colors, shadows, spacing, typography } from "./theme";

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
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },

  // Card styles
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    width: "100%",
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
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },

  buttonSecondary: {
    backgroundColor: colors.secondary,
  },

  buttonText: {
    color: colors.surface,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    textAlign: "center",
  },

  // Text styles
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: "center",
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontSize: typography.sizes.md,
    textAlign: "center",
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

  // Input styles
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 48,
  },

  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginTop: spacing.xs,
  },

  // Link styles
  linkContainer: {
    marginTop: spacing.xl,
    alignItems: "center",
  },

  linkText: {
    fontSize: typography.sizes.md,
    color: colors.textLight,
    textAlign: "center",
  },

  link: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },

  // Container styles
  successContainer: {
    backgroundColor: colors.background,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  errorContainer: {
    backgroundColor: colors.background,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  debugContainer: {
    backgroundColor: colors.background,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  debugTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  debugItem: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },

  debugKey: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.info,
    marginRight: spacing.sm,
    fontFamily: "monospace",
  },

  debugValue: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    fontFamily: "monospace",
    flex: 1,
  },

  emailText: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },

  // Session info styles
  sessionInfo: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },

  sessionValue: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontFamily: "monospace",
  },

  // Utility styles
  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  spaceBetween: {
    justifyContent: "space-between",
  },

  alignCenter: {
    alignItems: "center",
  },

  textCenter: {
    textAlign: "center",
  },

  marginBottom: {
    marginBottom: spacing.md,
  },

  fullWidth: {
    width: "100%",
  },

  // Todo-specific styles
  todoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },

  todoCompleted: {
    opacity: 0.7,
    borderColor: colors.success,
  },

  todoEditForm: {
    padding: spacing.md,
  },

  todoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  todoTitleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },

  todoTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },

  todoTitleCompleted: {
    textDecorationLine: "line-through",
    color: colors.textLight,
  },

  todoActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  completeButton: {
    backgroundColor: `${colors.success}20`,
  },

  editButton: {
    backgroundColor: `${colors.info}20`,
  },

  deleteButton: {
    backgroundColor: `${colors.error}20`,
  },

  actionButtonText: {
    fontSize: typography.sizes.md,
  },

  todoDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  todoDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
    marginBottom: spacing.sm,
  },

  todoDescriptionCompleted: {
    textDecorationLine: "line-through",
  },

  todoMeta: {
    marginTop: spacing.sm,
  },

  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },

  completionBadge: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
  },

  completionText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.medium,
  },

  // Page layout styles
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  pageTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flex: 1,
  },

  addButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.medium,
  },

  addButtonText: {
    fontSize: typography.sizes.xl,
    color: colors.surface,
    fontWeight: typography.weights.bold,
  },

  // Form styles
  formFields: {
    marginTop: spacing.sm,
  },

  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    gap: spacing.md,
  },

  primaryButton: {
    backgroundColor: colors.primary,
    flex: 1,
  },

  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },

  secondaryButtonText: {
    color: colors.text,
  },

  // Content layout styles
  contentSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },

  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  emptyStateText: {
    fontSize: typography.sizes.md,
    color: colors.textLight,
    textAlign: "center",
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },

  listContainer: {
    paddingBottom: spacing.xl,
  },

  dividerContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: 15,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textLight,
    fontWeight: "500" as const,
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
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.medium,
  },

  welcomeText: {
    fontSize: typography.sizes.lg,
    marginBottom: spacing.xl,
    textAlign: "center",
    color: colors.text,
    lineHeight: typography.sizes.lg * typography.lineHeights.normal,
  },

  authMessage: {
    fontSize: typography.sizes.md,
    textAlign: "center",
    color: colors.textLight,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },
});

// File upload specific styles
export const fileUploadStyles = StyleSheet.create({
  fileUpload: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },

  uploadIcon: {
    marginBottom: spacing.md,
  },

  uploadIconText: {
    fontSize: typography.sizes.xxxl,
  },

  uploadText: {
    fontSize: typography.sizes.md,
    color: colors.textLight,
    textAlign: "center",
  },

  fileName: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },

  buttonDisabled: {
    backgroundColor: colors.textPlaceholder,
  },

  emptyState: {
    alignItems: "center",
    padding: spacing.xl,
  },

  emptyIcon: {
    fontSize: typography.sizes.xxxl,
    marginBottom: spacing.md,
  },

  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  emptyDescription: {
    fontSize: typography.sizes.md,
    color: colors.textLight,
    textAlign: "center",
  },

  fileList: {
    maxHeight: 300,
  },

  fileItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  fileInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },

  fileNameText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  fileDetails: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
  },

  fileActions: {
    flexDirection: "row",
  },

  actionButton: {
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.borderLight,
  },

  deleteButton: {
    backgroundColor: colors.errorLight,
  },

  actionText: {
    fontSize: typography.sizes.md,
  },
});
