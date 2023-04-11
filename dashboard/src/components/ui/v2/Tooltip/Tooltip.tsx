import { styled } from '@mui/material';
import Box from '@mui/material/Box';
import type { TooltipProps as MaterialTooltipProps } from '@mui/material/Tooltip';
import MaterialTooltip, {
  tooltipClasses as materialTooltipClasses,
} from '@mui/material/Tooltip';
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
  [`&.${materialTooltipClasses.tooltip}`]: {
    fontSize: '0.9375rem',
    lineHeight: '1.375rem',
    backgroundColor:
      theme.palette.mode === 'dark'
        ? theme.palette.grey[400]
        : theme.palette.grey[700],
    color: theme.palette.common.white,
    padding: theme.spacing(0.75, 1.25),
    borderRadius: theme.shape.borderRadius,
    WebkitFontSmoothing: 'antialiased',
    boxShadow:
      '0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)',
    maxWidth: '17.5rem',
  },
  [`& .${materialTooltipClasses.arrow}`]: {
    color:
      theme.palette.mode === 'dark'
        ? theme.palette.grey[300]
        : theme.palette.grey[700],
  },
  [`&.${materialTooltipClasses.tooltipPlacementBottom}`]: {
    marginTop: `${theme.spacing(0.75)} !important`,
  },
  [`&.${materialTooltipClasses.tooltipPlacementBottom} .${materialTooltipClasses.arrow}`]:
    {
      marginTop: `${theme.spacing(-0.5)} !important`,
      color:
        theme.palette.mode === 'dark'
          ? theme.palette.grey[300]
          : theme.palette.grey[700],
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

export { materialTooltipClasses as tooltipClasses };

Tooltip.displayName = 'NhostTooltip';

export default forwardRef(Tooltip);
