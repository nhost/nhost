import { alpha, styled } from '@mui/material';
import type { SliderProps as MaterialSliderProps } from '@mui/material/Slider';
import MaterialSlider, {
  sliderClasses as materialSliderClasses,
} from '@mui/material/Slider';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';

export interface SliderProps
  extends PropsWithoutRef<Omit<MaterialSliderProps, 'color'>> {}

const StyledSlider = styled(MaterialSlider)(({ theme }) => ({
  color: theme.palette.primary.main,
  [`& .${materialSliderClasses.rail}`]: {
    backgroundColor: theme.palette.grey[400],
    height: 6,
  },
  [`& .${materialSliderClasses.track}`]: {
    backgroundColor: theme.palette.primary.main,
    height: 6,
  },
  [`& .${materialSliderClasses.thumb}`]: {
    width: 16,
    height: 16,
  },
  [`& .${materialSliderClasses.thumbColorPrimary}`]: {
    backgroundColor: theme.palette.primary.main,
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`,
    },
  },
}));

function Slider(props: SliderProps, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <StyledSlider
      color="primary"
      slotProps={{ thumb: {} }}
      ref={ref}
      {...props}
    />
  );
}

export { materialSliderClasses as sliderClasses };

Slider.displayName = 'NhostSlider';

export default forwardRef(Slider);
