import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { ChevronUpIcon } from '@/components/ui/v2/icons/ChevronUpIcon';
import {
  Button as ButtonUnstyled,
  type ButtonProps as ButtonUnstyledProps,
} from '@mui/base';
import { selectClasses as selectUnstyledClasses } from '@mui/base/Select';
import type { SxProps } from '@mui/material';
import { styled } from '@mui/material';
import type { Theme } from '@mui/system';
import type { DetailedHTMLProps, ForwardedRef, HTMLProps } from 'react';
import { forwardRef } from 'react';

export interface ToggleButtonProps
  extends Omit<ButtonUnstyledProps, 'slotProps'> {
  /**
   * Styles applied to the root element.
   */
  sx?: SxProps<Theme>;
  /**
   * Props for component slots.
   */
  slotProps?: {
    root?: Partial<ButtonUnstyledProps>;
    buttonLabel?: Partial<
      Omit<DetailedHTMLProps<HTMLProps<HTMLSpanElement>, HTMLSpanElement>, 'as'>
    >;
  };
  placeholder?: string;
}

const StyledButton = styled(ButtonUnstyled)(({ theme }) => ({
  display: 'grid',
  width: '100%',
  gridAutoFlow: 'column',
  justifyContent: 'space-between',
  gap: theme.spacing(),
  alignItems: 'center',
  fontFamily: theme.typography.fontFamily,
  fontSize: '0.9375rem',
  lineHeight: '1.375rem',
  fontWeight: 400,
  minHeight: '2.5rem',
  textAlign: 'left',
  color: theme.palette.text.primary,
  padding: theme.spacing(1, 1.25),
  transition: theme.transitions.create([
    'background-color',
    'border-color',
    'box-shadow',
  ]),
  border: `1px solid ${theme.palette.grey[400]}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  [`&.${selectUnstyledClasses.disabled}`]: {
    color: theme.palette.grey[600],
    borderColor: theme.palette.grey[400],
    backgroundColor: theme.palette.grey[200],
  },
  [`&.${selectUnstyledClasses.focusVisible}, &.${selectUnstyledClasses.expanded}`]:
    {
      outline: 'none',
      borderColor: theme.palette.primary.main,
    },
  [`&.${selectUnstyledClasses.expanded} .expand`]: {
    display: 'none',
  },
  [`&:not(.${selectUnstyledClasses.expanded}) .expand`]: {
    display: 'block',
  },
  [`&.${selectUnstyledClasses.expanded} .expanded`]: {
    display: 'block',
  },
  [`&:not(.${selectUnstyledClasses.expanded}) .expanded`]: {
    display: 'none',
  },
  '&.error': {
    borderColor: theme.palette.error.main,
  },
  [`&.${selectUnstyledClasses.focusVisible}.error`]: {
    borderColor: theme.palette.error.dark,
  },
}));

const StyledButtonLabel = styled('span')`
  display: flex;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ToggleButton = forwardRef(
  (
    { children, placeholder, slotProps, ...props }: ToggleButtonProps,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => (
    <StyledButton {...slotProps?.root} {...props} ref={ref}>
      <StyledButtonLabel {...slotProps?.buttonLabel}>
        {children || placeholder}
      </StyledButtonLabel>

      <ChevronDownIcon
        aria-label="Chevron down"
        sx={{ fontSize: '0.75rem' }}
        className="expand"
      />

      <ChevronUpIcon
        aria-label="Chevron up"
        sx={{ fontSize: '0.75rem' }}
        className="expanded"
      />
    </StyledButton>
  ),
);

ToggleButton.displayName = 'NhostToggleButton';

export default ToggleButton;
