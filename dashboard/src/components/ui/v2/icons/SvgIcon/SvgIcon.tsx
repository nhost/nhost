import type { SvgIconProps as MaterialSvgIconProps } from '@mui/material/SvgIcon';
import MaterialSvgIcon from '@mui/material/SvgIcon';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface SvgIconProps extends MaterialSvgIconProps {}

function SvgIcon(props: SvgIconProps, ref: ForwardedRef<SVGSVGElement>) {
  return <MaterialSvgIcon ref={ref} {...props} />;
}

export { svgIconClasses } from '@mui/material/SvgIcon';

SvgIcon.displayName = 'NhostSvgIcon';

export default forwardRef(SvgIcon);
