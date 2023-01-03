import type { BoxProps as MaterialBoxProps } from '@mui/material/Box';
import MaterialBox from '@mui/material/Box';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';

export interface BoxProps extends PropsWithoutRef<MaterialBoxProps> {}

function Box(props: BoxProps, ref: ForwardedRef<HTMLDivElement>) {
  return <MaterialBox ref={ref} {...props} />;
}

Box.displayName = 'NhostBox';

export default forwardRef(Box);
