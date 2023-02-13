import type { LinkProps as MaterialLinkProps } from '@mui/material/Link';
import MaterialLink from '@mui/material/Link';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface LinkProps extends MaterialLinkProps {
  /**
   * Controls when the link should have an underline.
   * @default 'hover'
   */
  underline?: MaterialLinkProps['underline'];
}

function Link(
  { children, underline = 'hover', ...props }: LinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <MaterialLink underline={underline} ref={ref} {...props}>
      {children}
    </MaterialLink>
  );
}

Link.displayName = 'NhostLink';

export default forwardRef(Link);
