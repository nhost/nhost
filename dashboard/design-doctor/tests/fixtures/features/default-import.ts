// expect: no-direct-radix-imports "DialogDefault"
import DialogDefault from '@radix-ui/react-dialog';
// expect: no-direct-radix-imports "DialogType"
import type DialogType from '@radix-ui/react-dialog';

void DialogDefault;
export type LocalDialog = DialogType;
