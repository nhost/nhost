import { styled } from '@mui/material';
import type { DialogTitleProps as MaterialDialogTitleProps } from '@mui/material/DialogTitle';
import MaterialDialogTitle from '@mui/material/DialogTitle';
import { XIcon } from 'lucide-react';
import type { MouseEventHandler } from 'react';
import { Button } from '@/components/ui/v2/Button';

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
          <XIcon className="h-5 w-5" />
        </Button>
      ) : null}
    </StyledDialogTitle>
  );
}

DialogTitle.displayName = 'NhostDialogTitle';

export default DialogTitle;
