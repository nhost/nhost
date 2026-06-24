import { zodResolver } from '@hookform/resolvers/zod';
import { graphql } from 'cm6-graphql';
import { PlusIcon, TrashIcon, TriangleAlert } from 'lucide-react';
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { FormCodeEditor } from '@/components/form/FormCodeEditor';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormSwitch } from '@/components/form/FormSwitch';
import { FormTextarea } from '@/components/form/FormTextarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
import { Separator } from '@/components/ui/v3/separator';
import { getOverlappingCustomTypenames } from '@/features/orgs/projects/actions/utils/getOverlappingCustomTypenames';
import { getActionSampleInputPayload } from '@/features/orgs/projects/actions/utils/getActionSampleInputPayload';
import { parseActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/parseActionDefinitionSdl';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { HeadersFormSection } from '@/features/orgs/projects/events/common/components/HeadersFormSection';
import { PayloadTransformFormSection } from '@/features/orgs/projects/events/common/components/PayloadTransformFormSection';
import { RequestOptionsFormSection } from '@/features/orgs/projects/events/common/components/RequestOptionsFormSection';
import { cn } from '@/lib/utils';
import type { DialogFormProps } from '@/types/common';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import {
  actionKindOptions,
  type BaseActionFormInitialData,
  type BaseActionFormValues,
  defaultFormValues,
  defaultPayloadTransformValues,
  defaultRequestOptionsTransformValues,
  defaultResponseTransformValues,
  validationSchema,
} from './BaseActionFormTypes';

const ACCORDION_SECTION_VALUES = [
  'headers-configuration',
  'transformation-configuration',
] as const;

type AccordionSectionValue = (typeof ACCORDION_SECTION_VALUES)[number];

const DIRTY_SOURCE_ID = 'base-action-form';

interface TransformSectionToggleProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  actionLabel: string;
}

function TransformSectionToggle({
  title,
  description,
  enabled,
  onToggle,
  actionLabel,
}: TransformSectionToggleProps) {
  return (
    <div className="flex items-end justify-between gap-2">
      <div className="space-y-1">
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'flex min-w-[14rem] flex-row items-center gap-2 text-foreground',
          {
            'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive':
              enabled,
          },
        )}
        onClick={onToggle}
      >
        {enabled ? (
          <>
            <TrashIcon className="size-4" />
            <span>Remove {actionLabel}</span>
          </>
        ) : (
          <>
            <PlusIcon className="size-4" />
            <span>Add {actionLabel}</span>
          </>
        )}
      </Button>
    </div>
  );
}

export interface BaseActionFormProps extends DialogFormProps {
  initialData?: BaseActionFormInitialData;
  onSubmit: (data: BaseActionFormValues) => void | Promise<void>;
  onCancel?: VoidFunction;
  /**
   * Custom types currently present in the metadata. Used to warn about types
   * that would be overwritten when saving the action.
   */
  existingCustomTypes: CustomTypes;
  /**
   * Names of the custom types already used by the action being edited. These
   * are excluded from the overwrite warning.
   */
  originalActionTypenames?: string[];
  submitButtonText: string;
}

export default function BaseActionForm({
  initialData,
  onSubmit,
  onCancel,
  existingCustomTypes,
  originalActionTypenames,
  submitButtonText,
  location,
}: BaseActionFormProps) {
  const { setDirtySource, closeDrawerWithDirtyGuard } = useDialog();

  const [openAccordionSections, setOpenAccordionSections] = useState<
    AccordionSectionValue[]
  >([]);

  const form = useForm<BaseActionFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData ?? defaultFormValues,
  });

  const { watch, setValue } = form;
  const { isDirty, isSubmitting } = form.formState;

  useEffect(() => {
    setDirtySource(DIRTY_SOURCE_ID, isDirty, location);
    return () => {
      setDirtySource(DIRTY_SOURCE_ID, false, location);
    };
  }, [isDirty, setDirtySource, location]);

  const actionDefinitionSdl = watch('actionDefinitionSdl');
  const typesSdl = watch('typesSdl');

  const isQueryAction = useMemo(
    () =>
      parseActionDefinitionSdl(actionDefinitionSdl).definition?.type ===
      'query',
    [actionDefinitionSdl],
  );

  const handleActionDefinitionChange = useCallback(
    (sdl: string) => {
      if (parseActionDefinitionSdl(sdl).definition?.type === 'query') {
        setValue('kind', 'synchronous');
      }
    },
    [setValue],
  );

  const overlappingTypenames = useMemo(
    () =>
      getOverlappingCustomTypenames(
        typesSdl,
        existingCustomTypes,
        originalActionTypenames ?? [],
      ),
    [typesSdl, existingCustomTypes, originalActionTypenames],
  );

  const handleFormSubmit = form.handleSubmit(
    async (values) => {
      await onSubmit(values);
    },
    () => {
      setOpenAccordionSections([...ACCORDION_SECTION_VALUES]);
    },
  );

  const isRequestOptionsTransformEnabled = Boolean(
    watch('requestOptionsTransform'),
  );
  const isPayloadTransformEnabled = Boolean(watch('payloadTransform'));
  const isResponseTransformEnabled = Boolean(watch('responseTransform'));

  const toggleRequestOptionsSectionOpen = () =>
    setValue(
      'requestOptionsTransform',
      isRequestOptionsTransformEnabled
        ? undefined
        : defaultRequestOptionsTransformValues,
      { shouldDirty: true },
    );

  const togglePayloadSectionOpen = () =>
    setValue(
      'payloadTransform',
      isPayloadTransformEnabled ? undefined : defaultPayloadTransformValues,
      { shouldDirty: true },
    );

  const toggleResponseSectionOpen = () =>
    setValue(
      'responseTransform',
      isResponseTransformEnabled ? undefined : defaultResponseTransformValues,
      { shouldDirty: true },
    );

  const handleResetSampleInput = useCallback(() => {
    const values = form.getValues();
    const { definition } = parseActionDefinitionSdl(values.actionDefinitionSdl);
    form.setValue(
      'payloadTransform.sampleInput',
      getActionSampleInputPayload(definition ?? undefined),
    );
  }, [form]);

  const handleAccordionValueChange = useCallback((value: string[]) => {
    setOpenAccordionSections(value as AccordionSectionValue[]);
  }, []);

  const handleCancel = (event: MouseEvent<HTMLButtonElement>) => {
    onCancel?.();
    closeDrawerWithDirtyGuard(event);
  };

  return (
    <Form {...form}>
      <form
        id="action-form"
        onSubmit={handleFormSubmit}
        className="box flex flex-auto flex-col content-between overflow-hidden border-t"
      >
        <div className="flex-auto overflow-y-auto pb-4">
          <div className="flex flex-auto flex-col">
            <div className="flex flex-col gap-6 p-6 text-foreground">
              <FormCodeEditor
                control={form.control}
                name="actionDefinitionSdl"
                aria-label="Action Definition"
                extensions={[graphql()]}
                onChange={handleActionDefinitionChange}
                label={
                  <>
                    Action Definition{' '}
                    <InfoTooltip>
                      Define the action as a single field under a{' '}
                      <code>Mutation</code> or <code>Query</code> type.
                    </InfoTooltip>
                  </>
                }
              />
              <FormCodeEditor
                control={form.control}
                name="typesSdl"
                aria-label="Type Configuration"
                extensions={[graphql()]}
                label={
                  <>
                    Type Configuration{' '}
                    <InfoTooltip>
                      Define the new input and output types used by the action.
                    </InfoTooltip>
                  </>
                }
              >
                {overlappingTypenames.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <div className="flex items-start gap-2">
                      <TriangleAlert className="size-5 shrink-0 text-amber-500" />
                      <p className="text-pretty text-muted-foreground text-sm">
                        The following types already exist and will be
                        overwritten when saving:{' '}
                        <span className="font-medium text-foreground">
                          {overlappingTypenames.join(', ')}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </FormCodeEditor>
              <Separator />
              <FormInput
                control={form.control}
                name="comment"
                label="Comment"
                placeholder="A statement to help describe the action in brief"
                className="max-w-lg"
                autoComplete="off"
              />
              <FormInput
                control={form.control}
                name="webhook"
                placeholder="{{NHOST_FUNCTIONS_URL}}/my-handler or https://example.com/handler"
                label={
                  <div className="flex flex-row items-center gap-2">
                    Webhook URL or template{' '}
                    <InfoTooltip>
                      Environment variables and secrets are available using the{' '}
                      {'{{VARIABLE}}'} tag.
                    </InfoTooltip>
                  </div>
                }
                className="max-w-lg text-foreground"
              />
              <FormSelect
                control={form.control}
                name="kind"
                disabled={isQueryAction}
                label={
                  <div className="flex flex-row items-center gap-2">
                    Kind{' '}
                    <InfoTooltip>
                      {isQueryAction
                        ? 'Query actions are always synchronous — only mutations can run asynchronously.'
                        : 'Asynchronous actions return an action id immediately and the response can be fetched later.'}
                    </InfoTooltip>
                  </div>
                }
                className="w-60 text-left text-foreground"
              >
                {actionKindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </FormSelect>
              <FormInput
                control={form.control}
                name="timeout"
                type="number"
                label={
                  <div className="flex flex-row items-center gap-2">
                    Timeout (seconds){' '}
                    <InfoTooltip>
                      Number of seconds to wait for the handler response before
                      timing out.
                    </InfoTooltip>
                  </div>
                }
                className="w-60 text-foreground"
              />
            </div>
            <Separator />
            <Accordion
              type="multiple"
              value={openAccordionSections}
              onValueChange={handleAccordionValueChange}
            >
              <AccordionItem value="headers-configuration" className="px-6">
                <AccordionTrigger className="text-base text-foreground">
                  Headers Settings
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-8 border-l">
                    <div className="pl-4">
                      <FormSwitch
                        control={form.control}
                        name="forwardClientHeaders"
                        inline
                        labelClassName="w-fit max-w-none whitespace-nowrap"
                        label={
                          <div className="flex flex-row items-center gap-2">
                            Forward client headers to webhook{' '}
                            <InfoTooltip>
                              Toggle forwarding the headers sent by the client
                              app in the request to your action handler.
                            </InfoTooltip>
                          </div>
                        }
                      />
                    </div>
                    <Separator />
                    <HeadersFormSection />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="transformation-configuration"
                className="px-6"
              >
                <AccordionTrigger className="text-base text-foreground">
                  Request & Response Options
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-8 border-l">
                    <div className="flex flex-col gap-6 pl-4">
                      <TransformSectionToggle
                        title="Request Options Transform"
                        description="Configuration to transform the request before sending it to the handler"
                        enabled={isRequestOptionsTransformEnabled}
                        onToggle={toggleRequestOptionsSectionOpen}
                        actionLabel="Options Transform"
                      />
                      {isRequestOptionsTransformEnabled && (
                        <RequestOptionsFormSection />
                      )}
                      {isRequestOptionsTransformEnabled &&
                        isPayloadTransformEnabled && <Separator />}
                      <TransformSectionToggle
                        title="Payload Transform"
                        description="Adjust the request body."
                        enabled={isPayloadTransformEnabled}
                        onToggle={togglePayloadSectionOpen}
                        actionLabel="Payload Transform"
                      />
                      {isPayloadTransformEnabled && (
                        <PayloadTransformFormSection
                          onResetSampleInput={handleResetSampleInput}
                        />
                      )}
                      {isResponseTransformEnabled &&
                        (isRequestOptionsTransformEnabled ||
                          isPayloadTransformEnabled) && <Separator />}
                      <TransformSectionToggle
                        title="Response Transform"
                        description="Transform the handler response before returning it to the client."
                        enabled={isResponseTransformEnabled}
                        onToggle={toggleResponseSectionOpen}
                        actionLabel="Response Transform"
                      />
                      {isResponseTransformEnabled && (
                        <FormTextarea
                          control={form.control}
                          name="responseTransform.template"
                          label={
                            <div className="flex flex-row items-center gap-2 text-foreground">
                              Response Body Transform Template
                              <InfoTooltip>
                                <p>
                                  The Kriti template that transforms the handler
                                  response into your action's output type.
                                </p>
                                <p>
                                  Use {'{{$body}}'} to access the original
                                  response body.
                                </p>
                              </InfoTooltip>
                            </div>
                          }
                          className="min-h-[250px] max-w-lg font-mono text-foreground"
                        />
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className="text-foreground"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <ButtonWithLoading
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty}
          >
            {submitButtonText}
          </ButtonWithLoading>
        </div>
      </form>
    </Form>
  );
}
