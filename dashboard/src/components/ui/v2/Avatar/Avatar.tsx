import { styled } from '@mui/material';
import type { AvatarProps as MaterialAvatarProps } from '@mui/material/Avatar';
import MaterialAvatar from '@mui/material/Avatar';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface AvatarProps extends MaterialAvatarProps {}

const StyledAvatar = styled(MaterialAvatar)(({ theme }) => ({
  borderWidth: 1,
  borderColor: theme.palette.grey[300],
}));

function Avatar(props: AvatarProps, ref: ForwardedRef<HTMLDivElement>) {
  return <StyledAvatar ref={ref} {...props} />;
}

Avatar.displayName = 'NhostAvatar';

export default forwardRef(Avatar);
