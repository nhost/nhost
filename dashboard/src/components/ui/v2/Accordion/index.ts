import AccordionRoot from './Accordion';
import AccordionActions from './AccordionActions';
import AccordionDetails from './AccordionDetails';
import AccordionSummary from './AccordionSummary';

export { default as BaseAccordion } from './Accordion';
export * from './AccordionActions';
export { default as AccordionActions } from './AccordionActions';
export * from './AccordionDetails';
export { default as AccordionDetails } from './AccordionDetails';
export * from './AccordionSummary';
export { default as AccordionSummary } from './AccordionSummary';

export const Accordion = {
  Root: AccordionRoot,
  Details: AccordionDetails,
  Summary: AccordionSummary,
  Actions: AccordionActions,
};
