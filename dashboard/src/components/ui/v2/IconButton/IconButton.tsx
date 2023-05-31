import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { styled } from '@mui/material/styles';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface IconButtonProps extends ButtonProps {}

const StyledButton = styled(Button)({
  padding: 0,
  minWidth: 0,
});

function IconButton(
  props: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  return <StyledButton ref={ref} {...props} />;
}

IconButton.displayName = 'NhostIconButton';

export default forwardRef(IconButton);
