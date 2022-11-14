import DropdownContent from './DropdownContent';
import DropdownItem from './DropdownItem';
import DropdownRoot from './DropdownRoot';
import DropdownTrigger from './DropdownTrigger';

export * from './DropdownContent';
export { default as DropdownContent } from './DropdownContent';
export * from './DropdownItem';
export { default as DropdownItem } from './DropdownItem';
export * from './DropdownRoot';
export { default as DropdownRoot } from './DropdownRoot';
export * from './DropdownTrigger';
export { default as DropdownTrigger } from './DropdownTrigger';
export { default as useDropdown } from './useDropdown';

export const Dropdown = {
  Root: DropdownRoot,
  Content: DropdownContent,
  Trigger: DropdownTrigger,
  Item: DropdownItem,
};
