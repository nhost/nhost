import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import { alpha, generateUtilityClass, styled } from '@mui/material';

const StyledRail = styled(Box)(({ theme }) => ({
  position: 'absolute',
  display: 'block',
  opacity: 1,
  backgroundColor: theme.palette.grey[200],
  height: 6,
  top: '50%',
  width: '100%',
  borderRadius: 3,
  transform: 'translateY(-50%)',
  overflow: 'hidden',
}));

const StyledRailMaxValue = styled(StyledRail)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.15),
}));

export interface SliderRailWithAllowedValueProps {
  /**
   * The maximum allowed value of the slider. The rail will be colored up to
   * this value.
   */
  allowed?: number;
  /**
   * The minimum value of the slider.
   */
  min?: number;
  /**
   * The maximum value of the slider.
   */
  max?: number;
}

export default function SliderRailWithAllowedValue(
  railAttributes?: SliderRailWithAllowedValueProps,
) {
  return function SliderRail(props: BoxProps) {
    return (
      <StyledRail component="span" {...props}>
        {railAttributes?.allowed > 0 && (
          <StyledRailMaxValue
            className={generateUtilityClass('MuiSlider', 'railMaxValue')}
            component="span"
            style={{
              width: `${(railAttributes.allowed / railAttributes.max) * 100}%`,
            }}
          />
        )}
      </StyledRail>
    );
  };
}
