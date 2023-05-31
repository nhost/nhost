import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { alpha, styled } from '@mui/material';
import type { SliderProps as MaterialSliderProps } from '@mui/material/Slider';
import MaterialSlider, {
  sliderClasses as materialSliderClasses,
} from '@mui/material/Slider';

const StyledRail = styled(Box)(({ theme }) => ({
  position: 'absolute',
  display: 'block',
  opacity: 1,
  backgroundColor: theme.palette.grey[200],
  height: 8,
  top: '50%',
  width: '100%',
  borderRadius: 3,
  transform: 'translateY(-50%)',
  overflow: 'hidden',
}));

const StyledInnerSlider = styled(MaterialSlider)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  height: 6,
  padding: 0,
  color: theme.palette.primary.main,
  [`& .${materialSliderClasses.rail}`]: {
    height: 6,
    opacity: 1,
    background: theme.palette.grey[200],
  },
  [`& .${materialSliderClasses.track}`]: {
    borderRadius: 0,
    border: 'none',
    height: 6,
    backgroundColor:
      theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.1)
        : alpha(theme.palette.primary.main, 0.15),
  },
  [`& .${materialSliderClasses.markActive}`]: {
    backgroundColor: alpha(theme.palette.primary.main, 0.5),
    opacity: 1,
  },
}));

export interface SliderRailProps extends MaterialSliderProps {
  /**
   * The value of the slider.
   */
  value: number;
}

export default function SliderRail({
  value,
  ...railAttributes
}: SliderRailProps) {
  return function Rail(props: BoxProps) {
    return (
      <StyledRail component="span" {...props}>
        {value > 0 && (
          <StyledInnerSlider
            {...railAttributes}
            value={value}
            disabled
            components={{ Thumb: () => null }}
          />
        )}
      </StyledRail>
    );
  };
}
