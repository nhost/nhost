// expect: no-direct-radix-imports "DialogDescription"
// expect: no-direct-radix-imports "DialogTitle"
// expect: no-direct-radix-imports "DialogTrigger"
// expect: no-direct-radix-imports "DialogContent"
// expect: no-direct-radix-imports "DialogPortal"
// expect: no-direct-radix-imports "DialogClose"
import { DialogDescription as Desc, DialogTitle as Title, DialogTrigger as Trig, DialogContent as Body, DialogPortal as Port, DialogClose as DClose } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DialogDescription"
// expect: no-direct-radix-imports "DialogTitle"
// expect: no-direct-radix-imports "DialogTrigger"
import type { DialogDescription as TypeDesc, DialogTitle as TypeTitle, DialogTrigger as TypeTrig } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DialogContent"
// expect: no-direct-radix-imports "DialogPortal"
import { type DialogContent as TypeBody, DialogPortal as InlinePort } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DefaultDialog"
// expect: no-direct-radix-imports "DialogClose"
import DefaultDialog, { DialogClose as Close } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DialogDescription"
// expect: no-direct-radix-imports "DialogTitle"
// expect: no-direct-radix-imports "DialogTrigger"
export { DialogDescription, DialogTitle as ExportTitle, DialogTrigger } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "'@radix-ui/react-dialog'"
export * from '@radix-ui/react-dialog';
// expect: no-direct-radix-imports "'@radix-ui/react-dialog'"
export * as Everything from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DialogNamespace"
import * as DialogNamespace from '@radix-ui/react-dialog';
// expect: no-direct-radix-imports "'@radix-ui/react-dialog'"
export const loadDialog = () => import('@radix-ui/react-dialog');

void [Desc, Title, Trig, Body, Port, DClose, InlinePort, Close, DefaultDialog, DialogNamespace];
export type CombinedTypes = [TypeDesc, TypeTitle, TypeTrig, TypeBody];
