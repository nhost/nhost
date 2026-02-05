import { Plus } from 'lucide-react';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { HeadersFormSection } from '@/features/orgs/projects/events/common/components/HeadersFormSection';
import { RetryConfigurationFormSection } from '@/features/orgs/projects/events/common/components/RetryConfigurationFormSection';
import { ScheduleAtTimePicker } from '@/features/orgs/projects/events/one-offs/components/ScheduleAtTimePicker';
import { useCreateOneOffForm } from '@/features/orgs/projects/events/one-offs/hooks/useCreateOneOffForm';

interface CreateOneOffFormProps {
  disabled?: boolean;
}

export default function CreateOneOffForm({ disabled }: CreateOneOffFormProps) {
  const showCreateButton = !disabled;

  const {
    form,
    isSheetOpen,
    showUnsavedChangesDialog,
    setShowUnsavedChangesDialog,
    openForm,
    handleSheetOpenChange,
    handleSubmit,
    closeForm,
  } = useCreateOneOffForm();

  return (
    <>
      {showCreateButton && (
        <Button onClick={openForm} size="sm">
          <Plus className="size-4" /> New One-off
        </Button>
      )}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          showOverlay
          className="box flex w-xl flex-auto flex-col gap-0 p-0 sm:max-w-4xl md:w-4xl"
        >
          <SheetHeader className="p-6">
            <SheetTitle className="text-lg">
              Create a New One-off scheduled event
            </SheetTitle>
            <SheetDescription>
              Enter the details to create your one-off. Click Create when you're
              done
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <Form {...form}>
            <form
              id="one-off-form"
              onSubmit={handleSubmit}
              className="flex flex-auto flex-col gap-4 overflow-y-auto pb-4"
            >
              <div className="flex flex-auto flex-col">
                <div className="flex flex-col gap-6 p-6 text-foreground">
                  <FormInput
                    control={form.control}
                    name="comment"
                    label="Comment"
                    placeholder="A statement to help describe the scheduled event in brief"
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <ScheduleAtTimePicker />
                  <Separator />
                </div>
                <div className="flex flex-col gap-6 px-6 py-6 text-foreground">
                  <FormInput
                    control={form.control}
                    name="webhook"
                    placeholder="https://httpbin.org/post or {{MY_WEBHOOK_URL}}/handler"
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Webhook URL or template{' '}
                        <InfoTooltip>
                          Environment variables and secrets are available using
                          the {'{{VARIABLE}}'} tag.
                        </InfoTooltip>
                      </div>
                    }
                    className="max-w-lg text-foreground"
                  />
                  <FormTextarea
                    control={form.control}
                    name="payload"
                    placeholder={`{
  "name": "John Doe",
  "company": "Acme"
}`}
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Payload{' '}
                        <InfoTooltip>
                          The request payload for the scheduled event, should be
                          a valid JSON
                        </InfoTooltip>
                      </div>
                    }
                    className="min-h-[250px] max-w-lg font-mono text-foreground"
                  />
                </div>
                <Separator />
                <Accordion type="single" collapsible>
                  <AccordionItem value="retry-configuration" className="px-6">
                    <AccordionTrigger className="text-base text-foreground">
                      Retry and Headers Settings
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-8 border-l">
                        <RetryConfigurationFormSection className="pl-4" />
                        <Separator />
                        <HeadersFormSection className="pl-4" />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </form>
          </Form>
          <SheetFooter className="flex-shrink-0 border-t p-2">
            <div className="flex flex-1 flex-row items-start justify-between gap-2">
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  className="text-foreground"
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
              </SheetClose>
              <ButtonWithLoading
                type="submit"
                form="one-off-form"
                loading={form.formState.isSubmitting}
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                Create
              </ButtonWithLoading>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
        onDiscardChanges={closeForm}
      />
    </>
  );
}
