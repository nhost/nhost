import type { ButtonProps } from '@/ui/v2/Button';
import Button from '@/ui/v2/Button';
import styled from '@emotion/styled';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface IconButtonProps extends ButtonProps {}

const StyledButton = styled(Button)({
  padding: 0,
  minWidth: `0 !important`,
});

function IconButton(
  props: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  return <StyledButton ref={ref} {...props} />;
}

IconButton.displayName = 'NhostIconButton';

export default forwardRef(IconButton);
