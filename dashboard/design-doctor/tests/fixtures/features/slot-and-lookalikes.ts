import SlotDefault, { Slot as SlotNamed, type Slottable } from '@radix-ui/react-slot';
import type { SlotProps, SlotOwnProps, SlotExtraProps } from '@radix-ui/react-slot';
import * as SlotNamespace from '@radix-ui/react-slot';
export { Slot as ExportedSlot, Slottable, SlotProps } from '@radix-ui/react-slot';
export * from '@radix-ui/react-slot';
export * as AllSlots from '@radix-ui/react-slot';
import '@radix-ui/react-slot';
export const loadSlot = () => import('@radix-ui/react-slot');

import LookalikeDefault, { DialogTitle as LookalikeTitle } from '@foo/radix-ui-react-dialog';
import type { DialogTitle as LookalikeType, DialogDescription, DialogTrigger } from '@foo/radix-ui-react-dialog';
import * as LookalikeNamespace from '@foo/radix-ui-react-dialog';
export { DialogContent, DialogPortal as ExportedPortal, DialogClose } from '@foo/radix-ui-react-dialog';
export * from '@foo/radix-ui-react-dialog';
export * as Lookalikes from '@foo/radix-ui-react-dialog';
import '@foo/radix-ui-react-dialog';
export const loadLookalike = () => import('@foo/radix-ui-react-dialog');
void [SlotDefault, SlotNamed, SlotNamespace, LookalikeDefault, LookalikeTitle, LookalikeNamespace];
export type BothTypes = [Slottable, SlotProps, SlotOwnProps, SlotExtraProps, LookalikeType, DialogDescription, DialogTrigger];
