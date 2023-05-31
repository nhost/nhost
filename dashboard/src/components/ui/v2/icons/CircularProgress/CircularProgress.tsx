import type { IconProps } from '@/components/ui/v2/icons';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import { keyframes } from '@emotion/react';
import { styled } from '@mui/material';

const spinAnimation = keyframes`
  to {
    transform: rotate(360deg)
  }
`;

const StyledSvgIcon = styled(SvgIcon)({
  animation: `${spinAnimation} 1s linear infinite`,
});

const StyledCircle = styled('circle')({
  opacity: 0.25,
});

const StyledPath = styled('path')({
  opacity: 0.75,
});

function CircularProgress(props: IconProps) {
  return (
    <StyledSvgIcon
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="progressbar"
      aria-label="A progress bar indicating loading progress"
      {...props}
    >
      <StyledCircle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        fill="none"
        strokeWidth="4"
      />

      <StyledPath
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </StyledSvgIcon>
  );
}

CircularProgress.displayName = 'NhostCircularProgress';

export default CircularProgress;
