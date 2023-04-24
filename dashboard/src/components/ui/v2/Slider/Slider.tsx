import { alpha, styled } from '@mui/material';
import type { SliderProps as MaterialSliderProps } from '@mui/material/Slider';
import MaterialSlider, {
  sliderClasses as materialSliderClasses,
} from '@mui/material/Slider';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import SliderRail from './SliderRail';

export interface SliderProps
  extends PropsWithoutRef<Omit<MaterialSliderProps, 'color'>> {
  /**
   * The maximum allowed value of the slider. The rail will be colored up to
   * this value.
   */
  allowed?: number;
}

const StyledSlider = styled(MaterialSlider)(({ theme }) => ({
  color: theme.palette.primary.main,
  [`& .${materialSliderClasses.mark}`]: {
    height: 6,
    width: 1,
    backgroundColor: theme.palette.grey[400],
  },
  [`& .${materialSliderClasses.rail}`]: {
    opacity: 1,
    backgroundColor: theme.palette.grey[200],
    height: 6,
  },
  [`& .${materialSliderClasses.markActive}`]: {
    opacity: 0,
  },
  [`& .${materialSliderClasses.track}`]: {
    backgroundColor: theme.palette.primary.main,
    height: 6,
  },
  [`& .${materialSliderClasses.thumb}`]: {
    width: 16,
    height: 16,
    '&:before': {
      boxShadow: 'none',
    },
  },
  [`& .${materialSliderClasses.thumbColorPrimary}`]: {
    backgroundColor: theme.palette.primary.main,
    [`&:focus, &:hover, &.${materialSliderClasses.active}, &.${materialSliderClasses.focusVisible}`]:
      {
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.35)}`,
      },
  },
}));

function Slider(
  { allowed, components, ...props }: SliderProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <StyledSlider
      ref={ref}
      components={{
        Rail: SliderRail({
          value: allowed,
          max: props.max,
          marks: props.marks,
          step: props.step,
        }),
        ...components,
      }}
      color="primary"
      {...props}
      marks={allowed > 0 ? false : props.marks}
    />
  );
}

export { materialSliderClasses as sliderClasses };

Slider.displayName = 'NhostSlider';

export default forwardRef(Slider);
