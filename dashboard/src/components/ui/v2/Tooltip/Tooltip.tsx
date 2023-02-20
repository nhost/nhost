import { styled } from '@mui/material';
import Box from '@mui/material/Box';
import type { TooltipProps as MaterialTooltipProps } from '@mui/material/Tooltip';
import MaterialTooltip, { tooltipClasses } from '@mui/material/Tooltip';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface TooltipProps extends MaterialTooltipProps {
  /**
   * Whether or not the tooltip should be visible. If `true`, the content of the
   * tooltip will be rendered, but the tooltip text will not appear.
   *
   * @default true
   */
  visible?: boolean;
  /**
   * Determines whether the tooltip's children are disabled. If true, the
   * tooltip's children will be wrapped in a `span` element.
   */
  hasDisabledChildren?: boolean;
}

const StyledTooltip = styled(Box)(({ theme }) => ({
  [`&.${tooltipClasses.tooltip}`]: {
    fontSize: '0.9375rem',
    lineHeight: '1.375rem',
    backgroundColor:
      theme.palette.mode === 'dark'
        ? theme.palette.grey[300]
        : theme.palette.grey[700],
    color: theme.palette.common.white,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    WebkitFontSmoothing: 'antialiased',
    boxShadow:
      '0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)',
    maxWidth: '17.5rem',
  },
  [`&.${tooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: `${theme.spacing(0.75)} !important`,
  },
}));

function Tooltip(
  { children, hasDisabledChildren, visible = true, ...props }: TooltipProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const tooltipChildren = hasDisabledChildren ? (
    <div>{children}</div>
  ) : (
    children
  );

  if (!visible) {
    // We need a fragment here because if we return `tooltipChildren` directly,
    // without any wrapper, it might not be rendered.
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{tooltipChildren}</>;
  }

  return (
    <MaterialTooltip
      components={{ Tooltip: StyledTooltip }}
      {...props}
      ref={ref}
    >
      {tooltipChildren}
    </MaterialTooltip>
  );
}

Tooltip.displayName = 'NhostTooltip';

export default forwardRef(Tooltip);
