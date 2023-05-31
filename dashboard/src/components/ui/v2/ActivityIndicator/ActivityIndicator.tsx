import type { IconProps } from '@/components/ui/v2/icons';
import { CircularProgress } from '@/components/ui/v2/icons/CircularProgress';
import { styled } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import Box from '@mui/material/Box';
import type { TypographyProps } from '@mui/material/Typography';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export interface ActivityIndicatorProps extends BoxProps {
  /**
   * Label of the activity indicator.
   */
  label?: ReactNode;
  /**
   * The delay in milliseconds before the loading component is shown.
   */
  delay?: number;
  /**
   * Props passed to the circular progress indicator.
   */
  circularProgressProps?: IconProps;
  /**
   * Props passed to the label component.
   */
  labelProps?: TypographyProps;
}

const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridAutoFlow: 'column',
  gap: theme.spacing(0.75),
  justifyContent: 'start',
  alignItems: 'center',
}));

const StyledCircularProgress = styled(CircularProgress)({
  width: 12,
  height: 12,
});

const StyledLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

function ActivityIndicator({
  id,
  label,
  delay = 0,
  circularProgressProps,
  ...props
}: ActivityIndicatorProps) {
  const [showActivityIndicator, setShowActivityIndicator] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShowActivityIndicator(true), delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  if (!showActivityIndicator) {
    // We are rendering a span instead of null in order to keep the layout
    // intact in certain cases (e.g. when elements have a "space-between"
    // position).
    return (
      <span
        role="progressbar"
        aria-label="Activity indicator placeholder"
        className="block h-0"
      />
    );
  }

  return (
    <StyledContainer
      role="progressbar"
      aria-labelledby={id}
      aria-label={!id ? label?.toString() : undefined}
      {...props}
    >
      <StyledCircularProgress {...circularProgressProps} role="none" />

      {label && (
        <StyledLabel variant="caption" id={id}>
          {label}
        </StyledLabel>
      )}
    </StyledContainer>
  );
}

ActivityIndicator.displayName = 'NhostActivityIndicator';

export default ActivityIndicator;
