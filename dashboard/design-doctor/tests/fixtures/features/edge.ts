// expect: no-direct-radix-imports "DialogTitleExtra"
import { DialogTitleExtra } from '@radix-ui/react-dialog';
// expect: no-direct-radix-imports "DialogTitle"
import { DialogTitle as ExtraTitle } from '@radix-ui/react-dialog-extra';
// expect: no-direct-radix-imports "DialogContent"
import { DialogContent } from "@radix-ui/react-dialog";
// expect: no-direct-radix-imports "DialogTitle"
// expect: no-direct-radix-imports "DialogContent"
import { DialogTitle as OtherTitle, DialogContent as Content } from '@radix-ui/react-dialog';

void DialogTitleExtra;
void ExtraTitle;
void DialogContent;
void OtherTitle;
void Content;
