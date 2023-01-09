import type { LinkProps as MaterialLinkProps } from '@mui/material/Link';
import MaterialLink from '@mui/material/Link';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface LinkProps extends MaterialLinkProps {}

function Link(
  { children, ...props }: LinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <MaterialLink ref={ref} {...props}>
      {children}
    </MaterialLink>
  );
}

Link.displayName = 'NhostLink';

export default forwardRef(Link);
