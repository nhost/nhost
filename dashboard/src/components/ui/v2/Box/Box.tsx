import { styled } from '@mui/material';
import type { BoxProps as MaterialBoxProps } from '@mui/material/Box';
import MaterialBox from '@mui/material/Box';
import { type BoxTypeMap } from '@mui/system';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';

export type BoxProps<
  D extends React.ElementType = BoxTypeMap['defaultComponent'],
  P = {},
> = PropsWithoutRef<MaterialBoxProps<D, P>>;

const StyledBox = styled(MaterialBox)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderColor: theme.palette.divider,
  color: theme.palette.text.primary,
}));

function Box(props: BoxProps, ref: ForwardedRef<HTMLDivElement>) {
  return <StyledBox ref={ref} {...props} />;
}

Box.displayName = 'NhostBox';

export default forwardRef(Box);
