/**
 * Design system constants for consistent theming across the app.
 * These values are used throughout the application for colors, spacing, and typography.
 */

export const colors = {
  // Primary brand colors
  primary: "#6366f1",
  primaryHover: "#5855eb",
  secondary: "#818cf8",

  // Background colors
  background: "#f5f5f5",
  surface: "#ffffff",
  overlay: "rgba(0, 0, 0, 0.5)",

  // Text colors
  text: "#333333",
  textLight: "#666666",
  textDark: "#1a1a1a",
  textPlaceholder: "#999999",

  // Status colors
  success: "#10b981",
  successLight: "#34d399",
  error: "#ef4444",
  errorLight: "#f87171",
  warning: "#f59e0b",
  info: "#3b82f6",

  // Border and divider colors
  border: "#e5e5e5",
  borderLight: "#f0f0f0",
  divider: "#e0e0e0",

  // Shadow color
  shadow: "#000000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  round: 50,
};

export const typography = {
  // Font sizes
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
  },

  // Font weights
  weights: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },

  // Line heights
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};

export const shadows = {
  small: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  large: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};
