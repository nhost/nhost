import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { twMerge } from 'tailwind-merge';

export type AvatarProps = Pick<BoxProps, 'component'> & {
  style?: {
    [key: string]: string;
  };
  className?: string;
  avatarUrl?: string | null;
  name?: string | null;
};

/**
 * @deprecated Use `v2/Avatar` instead.
 */
export default function Avatar({
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
    const initials = name
      .split(' ')
      .slice(0, 2)
      .map((currentNamePart) => `${currentNamePart.charAt(0).toUpperCase()}`)
      .join('');

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
      aria-label={name ? `Avatar of ${name}` : 'Avatar'}
      role="img"
      {...rest}
    />
  );
}
