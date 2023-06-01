import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { styled } from '@mui/material';

export interface AlertProps extends BoxProps {
  /**
   * Severity of the alert.
   *
   * @default 'info'
   */
  severity?: 'info' | 'success' | 'warning' | 'error';
}

const StyledBox = styled(Box)(({ theme }) => ({
  borderRadius: 4,
  padding: theme.spacing(1.5, 2),
  textAlign: 'center',
  fontSize: theme.typography.pxToRem(15),
  lineHeight: theme.typography.pxToRem(22),
  '@media (prefers-reduced-motion: no-preference)': {
    transition: theme.transitions.create('background-color'),
  },
}));

export default function Alert({
  severity = 'info',
  children,
  sx,
  ...props
}: AlertProps) {
  return (
    <StyledBox
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
        severity === 'error' && {
          backgroundColor: 'error.light',
          color: 'error.main',
        },
        severity === 'warning' && {
          backgroundColor: 'warning.light',
          color: 'text.primary',
        },
        severity === 'success' && {
          backgroundColor: 'success.light',
          color: 'success.dark',
        },
        severity === 'info' && { backgroundColor: 'primary.light' },
      ]}
      {...props}
    >
      {children}
    </StyledBox>
  );
}
