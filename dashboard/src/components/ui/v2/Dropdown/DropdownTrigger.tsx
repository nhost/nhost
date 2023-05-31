import type { BoxProps } from '@/components/ui/v2/Box';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { ChevronUpIcon } from '@/components/ui/v2/icons/ChevronUpIcon';
import { callAll } from '@/utils/callAll';
import { styled } from '@mui/material';
import type { ForwardedRef, MouseEvent } from 'react';
import { Children, cloneElement, forwardRef, isValidElement } from 'react';
import useDropdown from './useDropdown';

export interface DropdownTriggerProps
  extends Omit<BoxProps<'button'>, 'color'> {
  /**
   * Render the dropdown trigger as the given child element.
   */
  asChild?: boolean;
  /**
   * Native HTML button type.
   *
   * @default 'button'
   */
  type?: 'button' | 'reset' | 'submit';
  /**
   * Determines whether or not the chevron should be visible.
   *
   * @default false
   */
  hideChevron?: boolean;
}

const StyledButton = styled('button')(({ theme }) => ({
  display: 'grid',
  gridAutoFlow: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: theme.palette.background.paper,
  [`&:not([disabled]):hover`]: {
    backgroundColor: theme.palette.action.hover,
  },
  [`&:not([disabled]):focus`]: {
    backgroundColor: theme.palette.action.focus,
  },
}));

function ChevronIcon({ open }: { open: boolean }) {
  if (open) {
    <ChevronUpIcon sx={{ fontSize: '0.75rem' }} />;
  }

  return <ChevronDownIcon sx={{ fontSize: '0.75rem' }} />;
}

function DropdownTrigger(
  {
    asChild,
    children,
    type = 'button',
    hideChevron,
    onClick,
    ...props
  }: DropdownTriggerProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const { id, handleOpen, open } = useDropdown();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (onClick) {
      onClick(event);
    }

    handleOpen(event);
  }

  const sharedProps = {
    ref,
    type,
    'aria-describedby': id,
    'aria-controls': open ? 'basic-menu' : undefined,
    'aria-expanded': open ? 'true' : undefined,
    'aria-haspopup': 'listbox',
    onClick: handleClick,
    ...props,
    style: open ? { ...props.style, opacity: 1 } : props.style,
  };

  if (asChild && Children.count(children) === 1 && isValidElement(children)) {
    return cloneElement(
      children,
      {
        ...children.props,
        ...sharedProps,
        onClick: callAll(sharedProps.onClick, children.props.onClick),
      },
      <>
        {children.props?.children} {!hideChevron && <ChevronIcon open={open} />}
      </>,
    );
  }

  return (
    <StyledButton
      component="button"
      ref={ref}
      type={type}
      aria-describedby={id}
      aria-controls={open ? 'basic-menu' : undefined}
      aria-expanded={open ? 'true' : undefined}
      onClick={handleClick}
      {...props}
    >
      {children}

      {!hideChevron && <ChevronIcon open={open} />}
    </StyledButton>
  );
}

DropdownTrigger.displayName = 'NhostDropdownTrigger';

export default forwardRef(DropdownTrigger);
