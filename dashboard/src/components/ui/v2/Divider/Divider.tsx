import { styled } from '@mui/material';
import type {
  DividerTypeMap,
  DividerProps as MaterialDividerProps,
} from '@mui/material/Divider';
import MaterialDivider from '@mui/material/Divider';

export type DividerProps<
  D extends React.ElementType = DividerTypeMap['defaultComponent'],
  P = {},
> = MaterialDividerProps<D, P>;

const StyledDivider = styled(MaterialDivider)(({ theme }) => ({
  // todo: change this behaviour later - we should make this possible to
  // configure via `className`
  margin: `0 !important`,
  backgroundColor: theme.palette.divider,
}));

function Divider<
  D extends React.ElementType = DividerTypeMap['defaultComponent'],
  P = {},
>(props: DividerProps<D, P>) {
  return <StyledDivider {...props} />;
}

Divider.displayName = 'NhostDivider';

export default Divider;
