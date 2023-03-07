import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
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
  [`& .${materialSliderClasses.thumb}`]: {
    display: 'none',
  },
  [`& .${materialSliderClasses.rail}`]: {
    height: 6,
    opacity: 1,
    background: theme.palette.grey[200],
  },
  [`& .${materialSliderClasses.track}`]: {
    borderRadius: 0,
    border: 'none',
    height: 6,
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
  [`& .${materialSliderClasses.markActive}`]: {
    backgroundColor: alpha(theme.palette.primary.main, 0.5),
    opacity: 1,
  },
}));

export interface SliderRailProps extends MaterialSliderProps {
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

export default function SliderRail({
  allowed,
  min,
  max,
  ...railAttributes
}: SliderRailProps) {
  return function Rail(props: BoxProps) {
    return (
      <StyledRail component="span" {...props}>
        {allowed > 0 && (
          <StyledInnerSlider
            min={min}
            max={max}
            value={allowed}
            disabled
            {...railAttributes}
          />
        )}
      </StyledRail>
    );
  };
}
