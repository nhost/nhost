import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

type AvatarProps = Pick<BoxProps, 'component'> & {
  style?: {
    [key: string]: string;
  };
  className?: string;
  avatarUrl?: string | null;
  name?: string | null;
};

export function Avatar({
  style = {},
  className = '',
  avatarUrl,
  name = '',
  ...rest
}: AvatarProps) {
  const noAvatar = !avatarUrl || avatarUrl.includes('blank');

  const classes = twMerge(
    'border rounded-full bg-cover bg-center',
    className,
    noAvatar && 'border-0 text-white flex items-center justify-center',
  );

  if (noAvatar) {
    // get initials of `name`
    let initials = '';

    if (name) {
      name
        .split(' ') // split names to arary
        .slice(0, 2) // only use first two elements (first and last name)
        .forEach((element) => {
          initials += element.charAt(0).toUpperCase(); // get first char of [first, last]-name
        });
    }

    return (
      <Box
        className={classes}
        style={style}
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? `grey.400` : `grey.500`,
          color: (theme) => `${theme.palette.common.white} !important`,
        }}
        {...rest}
      >
        {initials}
      </Box>
    );
  }

  return (
    <Box
      style={Object.assign(style, { backgroundImage: `url(${avatarUrl})` })}
      className={classes}
      {...rest}
    />
  );
}

export default Avatar;
