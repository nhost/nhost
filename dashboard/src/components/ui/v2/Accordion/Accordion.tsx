import { styled } from '@mui/material';
import type { AccordionProps as MaterialAccordionProps } from '@mui/material/Accordion';

import MaterialAccordion, {
    accordionClasses,
    getAccordionUtilityClass,
} from '@mui/material/Accordion';
import type { ElementType } from 'react';

export interface AccordionProps extends MaterialAccordionProps{}

const Accordion = styled(MaterialAccordion)<AccordionProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
  borderBottom: `transparent solid 0px`,
  boxShadow: `none`,
  [`&.${accordionClasses.root}`]: {
    overflowX: 'hidden',
  },
  [`&.${accordionClasses.expanded}`]: {
  marginTop: 0,
  marginBottom: 0,
  },
}));

Accordion.displayName = 'NhostAccordion';

export default Accordion;
