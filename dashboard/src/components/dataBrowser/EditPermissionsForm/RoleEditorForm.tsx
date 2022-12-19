import Form from '@/components/common/Form';
import InlineCode from '@/components/common/InlineCode';
import type { DatabaseAction } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import type { PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

export interface RoleEditorFormValues {}

export interface RoleEditorFormProps {
  /**
   * The role that is being edited.
   */
  selectedRole: string;
  /**
   * The action that is being edited.
   */
  selectedAction: DatabaseAction;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: VoidFunction;
  /**
   * Function to be called when the editing is cancelled.
   */
  onCancel: VoidFunction;
}

function HighlightedText({ children }: PropsWithChildren<unknown>) {
  return (
    <InlineCode className="text-greyscaleDark bg-primary-light font-display text-sm">
      {children}
    </InlineCode>
  );
}

export default function RoleEditorForm({
  selectedRole,
  selectedAction,
  onSubmit,
  onCancel,
}: RoleEditorFormProps) {
  const form = useForm<RoleEditorFormValues>({});
  const isDirty = false;
  const isSubmitting = false;

  function handleSubmit() {
    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1 border-gray-200 bg-[#fafafa]"
      >
        <div className="grid grid-flow-row gap-6 content-start flex-auto py-4">
          <section className="bg-white border-y-1 border-gray-200">
            <Text
              component="h2"
              className="px-6 py-3 font-bold border-b-1 border-gray-200"
            >
              Selected role & action
            </Text>

            <div className="grid grid-flow-col gap-2 items-center justify-between px-6 py-4">
              <div className="grid grid-flow-col gap-4">
                <Text>
                  Role: <HighlightedText>{selectedRole}</HighlightedText>
                </Text>

                <Text>
                  Action: <HighlightedText>{selectedAction}</HighlightedText>
                </Text>
              </div>

              <Button variant="borderless" onClick={onCancel}>
                Change
              </Button>
            </div>
          </section>
        </div>

        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 border-gray-200 p-2 bg-white">
          <Button
            variant="borderless"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          <Button
            loading={isSubmitting}
            disabled={isSubmitting}
            type="submit"
            className="justify-self-end"
          >
            Save
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
