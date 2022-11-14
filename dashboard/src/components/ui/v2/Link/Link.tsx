import type { LinkProps as MaterialLinkProps } from '@mui/material/Link';
import MaterialLink from '@mui/material/Link';

export interface LinkProps extends MaterialLinkProps {}

function Link({ children, ...props }: LinkProps) {
  return <MaterialLink {...props}>{children}</MaterialLink>;
}

Link.displayName = 'NhostLink';

export default Link;
