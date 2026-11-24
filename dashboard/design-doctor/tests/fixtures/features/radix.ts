// expect: no-direct-radix-imports "DialogDescription"
import { DialogDescription } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DialogProps"
import type { DialogProps } from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "DialogPrimitive"
import * as DialogPrimitive from '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "HoverCardPortal"
export { HoverCardPortal } from '@radix-ui/react-hover-card';

// expect: no-direct-radix-imports "'@radix-ui/react-dialog'"
export const load = () => import('@radix-ui/react-dialog');

void DialogDescription;
export type DialogComponent = DialogProps;
void DialogPrimitive;
