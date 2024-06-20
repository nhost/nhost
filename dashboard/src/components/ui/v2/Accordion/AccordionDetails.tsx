import { styled } from '@mui/material';
import type { AccordionDetailsProps as MaterialAccordionDetailsProps } from '@mui/material/AccordionDetails';

import MaterialAccordionDetails from '@mui/material/AccordionDetails';

export interface AccordionDetailsProps extends MaterialAccordionDetailsProps {}

const AccordionDetails = styled(
  MaterialAccordionDetails,
)<AccordionDetailsProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
  backgroundColor: theme.palette.grey[200],
  marginTop: 0,
  marginBottom: 0,
}));

AccordionDetails.displayName = 'NhostAccordionDetails';

export default AccordionDetails;
