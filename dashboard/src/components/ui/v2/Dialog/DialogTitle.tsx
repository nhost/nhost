import { Button } from '@/components/ui/v2/Button';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { styled } from '@mui/material';
import type { DialogTitleProps as MaterialDialogTitleProps } from '@mui/material/DialogTitle';
import MaterialDialogTitle from '@mui/material/DialogTitle';
import type { MouseEventHandler } from 'react';

export interface DialogTitleProps extends MaterialDialogTitleProps {
  /**
   * Function to be called when the user clicks the close button.
   */
  onClose?: MouseEventHandler;
}

const StyledDialogTitle = styled(MaterialDialogTitle)(({ theme }) => ({
  display: 'grid',
  gridAutoFlow: 'column',
  justifyContent: 'space-between',
  fontFamily: theme.typography.fontFamily,
  fontSize: '1.125rem',
  lineHeight: '1.625rem',
  padding: theme.spacing(0, 0, 1, 0),
  alignItems: 'center',
}));

function DialogTitle({ children, onClose, ...props }: DialogTitleProps) {
  return (
    <StyledDialogTitle {...props}>
      {/*
       * This empty span makes sure that the close button is aligned to the
       * right if content is unavailable.
       */}
      {children || <span />}

      {onClose ? (
        <Button
          variant="borderless"
          color="secondary"
          size="small"
          aria-label="Close"
          onClick={onClose}
          sx={{ padding: (theme) => theme.spacing(0.5), minWidth: 'initial' }}
        >
          <XIcon fontSize="small" />
        </Button>
      ) : null}
    </StyledDialogTitle>
  );
}

DialogTitle.displayName = 'NhostDialogTitle';

export default DialogTitle;
