import { styled } from '@mui/material';
import type { AvatarProps as MaterialAvatarProps } from '@mui/material/Avatar';
import MaterialAvatar from '@mui/material/Avatar';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface AvatarProps extends MaterialAvatarProps {}

const StyledAvatar = styled(MaterialAvatar)(({ theme }) => ({
  borderWidth: 1,
  borderColor: theme.palette.grey[300],
  fontSize: 12,
  backgroundColor: theme.palette.grey[200],
  color: theme.palette.text.primary,
}));

function Avatar(
  { children, ...props }: AvatarProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const initials =
    typeof children === 'string'
      ? children
          ?.split(' ')
          .slice(0, 2)
          .map(
            (currentNamePart) => `${currentNamePart.charAt(0).toUpperCase()}`,
          )
          .join('')
      : '';

  return (
    <StyledAvatar ref={ref} {...props}>
      {initials}
    </StyledAvatar>
  );
}

Avatar.displayName = 'NhostAvatar';

export default forwardRef(Avatar);
