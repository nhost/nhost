import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import InlineCode from '@/components/common/InlineCode';
import RuleGroupEditor from '@/components/dataBrowser/RuleGroupEditor';
import type { DatabaseAction, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Radio from '@/ui/v2/Radio';
import RadioGroup from '@/ui/v2/RadioGroup';
import Text from '@/ui/v2/Text';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

export interface RoleEditorFormValues {
  permissions: RuleGroup;
}

export interface RoleEditorFormProps {
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
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
  schema,
  table,
  selectedRole,
  selectedAction,
  onSubmit,
  onCancel,
}: RoleEditorFormProps) {
  const form = useForm<RoleEditorFormValues>({
    defaultValues: {
      permissions: {
        operator: '_and',
        rules: [{ column: '', operator: '_eq', value: '' }],
        groups: [],
      },
    },
  });

  const {
    setValue,
    getValues,
    formState: { dirtyFields, isSubmitting },
  } = form;

  const { onDirtyStateChange } = useDialog();
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'drawer');
  }, [isDirty, onDirtyStateChange]);

  const [temporaryPermissions, setTemporaryPermissions] =
    useState<RuleGroup>(null);
  const [checkType, setCheckType] = useState<'none' | 'custom'>(null);

  function handleSubmit(values: RoleEditorFormValues) {
    console.log(values);
    onDirtyStateChange(false, 'drawer');
    onSubmit?.();
  }

  function handleCheckTypeChange(value: typeof checkType) {
    setCheckType(value);

    if (value === 'none') {
      setTemporaryPermissions(getValues().permissions);

      // Note: https://github.com/react-hook-form/react-hook-form/issues/4055#issuecomment-950145092
      // @ts-ignore
      setValue('permissions', {});

      return;
    }

    setCheckType(value);
    setValue(
      'permissions',
      temporaryPermissions || {
        operator: '_and',
        rules: [{ column: '', operator: '_eq', value: '' }],
        groups: [],
      },
    );
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

          <section className="bg-white border-y-1 border-gray-200">
            <Text
              component="h2"
              className="px-6 py-3 font-bold border-b-1 border-gray-200"
            >
              Row select permissions
            </Text>

            <div className="grid grid-flow-row gap-4 items-center px-6 py-4">
              <Text>
                Allow role <HighlightedText>{selectedRole}</HighlightedText> to{' '}
                <HighlightedText>{selectedAction}</HighlightedText> rows:
              </Text>

              <RadioGroup
                className="grid grid-flow-col justify-start gap-4"
                onChange={(_event, value) =>
                  handleCheckTypeChange(value as typeof checkType)
                }
              >
                <Radio value="none" label="Without any checks" />
                <Radio value="custom" label="With custom check" />
              </RadioGroup>

              {checkType === 'custom' && (
                <RuleGroupEditor
                  name="permissions"
                  schema={schema}
                  table={table}
                />
              )}

              <Input
                type="number"
                label="Limit number of rows"
                slotProps={{
                  input: { className: 'max-w-xs w-full' },
                  inputRoot: { min: 0 },
                }}
                helperText="Set limit on number of rows fetched per request."
              />
            </div>
          </section>

          <section className="bg-white border-y-1 border-gray-200">
            <Text
              component="h2"
              className="px-6 py-3 font-bold border-b-1 border-gray-200"
            >
              Column select permissions
            </Text>

            <div className="grid grid-flow-row gap-4 items-center px-6 py-4">
              <div className="grid grid-flow-col justify-between gap-2 items-center">
                <Text>
                  Allow role <HighlightedText>{selectedRole}</HighlightedText>{' '}
                  to <HighlightedText>{selectedAction}</HighlightedText>{' '}
                  columns:
                </Text>

                <Button variant="borderless" size="small">
                  Select All
                </Button>
              </div>

              <Text variant="subtitle1">
                For <strong>relationships</strong>, set permissions for the
                corresponding tables/views.
              </Text>
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
