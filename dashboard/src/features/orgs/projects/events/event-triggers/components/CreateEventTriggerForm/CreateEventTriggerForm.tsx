import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet-drawer';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export interface CreateEventTriggerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
}

const formSchema = z
  .object({
    triggerName: z
      .string()
      .min(1, { message: 'Trigger name is required' })
      .max(42, { message: 'Trigger name must be at most 42 characters' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message:
          'Trigger name can only contain alphanumeric characters, underscores, and hyphens',
      }),
    dataSource: z.string({ required_error: 'Data source is required' }),
    tableName: z.string({ required_error: 'Table name is required' }),
    tableSchema: z.string({ required_error: 'Schema name is required' }),
    webhook: z
      .string()
      .min(1, { message: 'Webhook is required' })
      .url({ message: 'Invalid webhook URL' }),
    triggerOperations: z
      .array(z.enum(['insert', 'update', 'delete', 'manual']))
      .refine((value) => value.some((item) => item), {
        message: 'At least one trigger operation is required',
      }),
    updateTriggerOn: z.enum(['all', 'choose']).optional(),
    updateTriggerColumns: z.array(z.string()).optional(),
    retryConf: z.object({
      numRetries: z.number().min(0),
      intervalSec: z.number().min(0),
      timeoutSec: z.number().min(0),
    }),
    headers: z.array(
      z
        .object({
          name: z.string().min(1),
          value: z.string().min(1).optional(),
          valueFromEnv: z.string().min(1).optional(),
        })
        .refine((item) => item.value || item.valueFromEnv, {
          message: 'Value is required',
        }),
    ),
  })
  .refine(
    (data) => {
      if (data.updateTriggerOn === 'all') {
        return (data.updateTriggerColumns?.length ?? 0) > 0;
      }
      return true;
    },
    {
      message: 'At least one column is required for update trigger',
      path: ['updateTriggerColumns'],
    },
  );

export default function CreateEventTriggerForm({
  open,
  onOpenChange,
  onSubmit,
}: CreateEventTriggerFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-xl md:w-4xl flex flex-auto flex-col p-6 sm:max-w-4xl">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-auto flex-col gap-4"
          >
            <SheetHeader className="p-0">
              <SheetTitle className="text-lg">
                Create a New Event Trigger
              </SheetTitle>
              <SheetDescription>
                Make changes to your event trigger here. Click save when
                you&apos;re done.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-auto">
              <FormField
                control={form.control}
                name="triggerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger Name</FormLabel>
                    <FormControl>
                      <Input placeholder="trigger_name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="p-0">
              <div className="flex flex-1 flex-row items-start justify-between gap-2">
                <SheetClose asChild>
                  <Button variant="ghost" className="text-foreground">
                    Cancel
                  </Button>
                </SheetClose>
                <Button type="submit">Create</Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
