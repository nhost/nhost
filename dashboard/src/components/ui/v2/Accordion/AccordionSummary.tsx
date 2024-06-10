import { styled } from '@mui/material';
import type { AccordionSummaryProps as MaterialAccordionSummaryProps } from '@mui/material/AccordionSummary';

import MaterialAccordionSummary, {
    accordionSummaryClasses,
    getAccordionSummaryUtilityClass,
} from '@mui/material/AccordionSummary';
import type { ElementType } from 'react';

export interface AccordionSummaryProps extends MaterialAccordionSummaryProps{}

const AccordionSummary = styled(MaterialAccordionSummary)<AccordionSummaryProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
}));

AccordionSummary.displayName = 'NhostAccordionSummary';

export default AccordionSummary;
