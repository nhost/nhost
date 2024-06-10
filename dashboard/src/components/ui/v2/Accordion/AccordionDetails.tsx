import { styled } from '@mui/material';
import type { AccordionDetailsProps as MaterialAccordionDetailsProps } from '@mui/material/AccordionDetails';

import MaterialAccordionDetails, {
    accordionDetailsClasses,
    getAccordionDetailsUtilityClass,
} from '@mui/material/AccordionDetails';
import type { ElementType } from 'react';

export interface AccordionDetailsProps extends MaterialAccordionDetailsProps{}

const AccordionDetails = styled(MaterialAccordionDetails)<AccordionDetailsProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
}));

AccordionDetails.displayName = 'NhostAccordionDetails';

export default AccordionDetails;
