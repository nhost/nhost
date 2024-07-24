import { styled } from '@mui/material';
import type { AccordionActionsProps as MaterialAccordionActionsProps } from '@mui/material/AccordionActions';

import MaterialAccordionActions from '@mui/material/AccordionActions';

export interface AccordionActionsProps extends MaterialAccordionActionsProps {}

const AccordionActions = styled(
  MaterialAccordionActions,
)<AccordionActionsProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
}));

AccordionActions.displayName = 'NhostAccordionActions';

export default AccordionActions;
