import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { zodResolver } from '@hookform/resolvers/zod';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { ExpandIcon, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Combobox } from '@/components/ui/v3/combobox';
import { CommandItem } from '@/components/ui/v3/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  type BaseNativeQueryFormProps,
  createNativeQueryFormSchema,
  DEFAULT_VALUES,
} from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm/BaseNativeQueryFormTypes';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/CreateLogicalModelForm';
import { NativeQueryArgumentsSection } from '@/features/orgs/projects/database/native-queries/components/NativeQueryArgumentsSection';
import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import { useThemePreference } from '@/providers/Theme';

export type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';

export default function BaseNativeQueryForm({
  values = DEFAULT_VALUES,
  originalName,
  logicalModelNames,
  isPending,
  onSubmit,
  onCancel,
  onDirtyChange,
}: BaseNativeQueryFormProps) {
  const { resolvedTheme } = useThemePreference();
  const editorTheme = resolvedTheme === 'light' ? githubLight : githubDark;
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [isLogicalModelDialogOpen, setIsLogicalModelDialogOpen] =
    useState(false);
  const [isEmbeddedLogicalModelDirty, setIsEmbeddedLogicalModelDirty] =
    useState(false);
  const [showEmbeddedDiscardDialog, setShowEmbeddedDiscardDialog] =
    useState(false);
  const returnsTriggerRef = useRef<HTMLButtonElement>(null);
  const shouldOpenLogicalModelDialogRef = useRef(false);
  const sortedLogicalModelNames = [...logicalModelNames].sort((left, right) =>
    left.localeCompare(right),
  );
  const form = useForm<NativeQueryFormValues>({
    resolver: zodResolver(createNativeQueryFormSchema()),
    defaultValues: values,
    reValidateMode: 'onSubmit',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'arguments',
  });
  const watchedArguments = useWatch({
    control: form.control,
    name: 'arguments',
  });
  const { setValue } = form;
  const { isDirty } = form.formState;

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty: nextIsDirty }) => {
        onDirtyChange?.(Boolean(nextIsDirty));
      },
    });
    return () => {
      unsubscribe();
      onDirtyChange?.(false);
    };
  }, [form, onDirtyChange]);

  function closeLogicalModelDialog() {
    setIsEmbeddedLogicalModelDirty(false);
    setShowEmbeddedDiscardDialog(false);
    setIsLogicalModelDialogOpen(false);
  }

  function requestLogicalModelDialogClose() {
    if (isEmbeddedLogicalModelDirty) {
      setShowEmbeddedDiscardDialog(true);
      return;
    }

    closeLogicalModelDialog();
  }

  return (
    <>
      <form
        className="box flex min-h-0 flex-auto flex-col content-between overflow-hidden border-t"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex min-h-0 flex-auto flex-col overflow-hidden px-6 pt-4 pb-4">
          <div className="grid shrink-0 gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="native-query-name">Root field name</Label>
              <Input
                id="native-query-name"
                placeholder="root_field_name"
                className="max-w-md"
                wrapperClassName="sm:max-w-[calc(50%-0.625rem)]"
                {...form.register('rootFieldName')}
              />
              {form.formState.errors.rootFieldName && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.rootFieldName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="native-query-description">Description</Label>
              <Input
                id="native-query-description"
                placeholder="Optional native query description"
                className="max-w-md"
                {...form.register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="native-query-returns">
                Returns logical model
              </Label>
              <Controller
                control={form.control}
                name="returns"
                render={({ field, fieldState }) => (
                  <Combobox
                    ref={returnsTriggerRef}
                    id="native-query-returns"
                    className="flex h-10 max-w-md"
                    aria-label="Returns logical model"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error
                        ? 'native-query-returns-error'
                        : undefined
                    }
                    value={field.value || null}
                    options={sortedLogicalModelNames.map((name) => ({
                      value: name,
                      label: name,
                    }))}
                    placeholder="Select a logical model"
                    searchPlaceholder="Search logical models..."
                    emptyText="No logical models found."
                    open={returnsOpen}
                    onOpenChange={setReturnsOpen}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    onCloseAutoFocus={(event) => {
                      if (!shouldOpenLogicalModelDialogRef.current) {
                        return;
                      }

                      event.preventDefault();
                      shouldOpenLogicalModelDialogRef.current = false;
                      setIsLogicalModelDialogOpen(true);
                    }}
                    footerSlot={
                      <CommandItem
                        forceMount
                        value="__native-query-create-logical-model__"
                        className="rounded-none border-t px-3 py-2"
                        onSelect={() => {
                          shouldOpenLogicalModelDialogRef.current = true;
                          setReturnsOpen(false);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create logical model
                      </CommandItem>
                    }
                  />
                )}
              />
              {form.formState.errors.returns && (
                <p
                  id="native-query-returns-error"
                  className="text-destructive text-sm"
                >
                  {form.formState.errors.returns.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>SQL</Label>
              <Controller
                control={form.control}
                name="code"
                render={({ field }) => (
                  <div className="relative">
                    <CodeMirror
                      aria-label="SQL"
                      value={field.value}
                      height="180px"
                      className="overflow-hidden rounded-md border"
                      theme={editorTheme}
                      extensions={[sql({ dialect: PostgreSQL })]}
                      onChange={field.onChange}
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Expand SQL editor"
                          aria-label="Expand SQL editor"
                          className="absolute top-1 right-2 z-10 h-6 w-6 bg-background/90 hover:bg-accent"
                        >
                          <ExpandIcon className="h-4 w-4" strokeWidth={1} />
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        className="flex h-[85vh] min-h-0 w-[90vw] max-w-[90vw] flex-col overflow-hidden text-foreground md:w-[90vw]"
                        onEscapeKeyDown={(event) => event.stopPropagation()}
                      >
                        <DialogHeader className="shrink-0">
                          <DialogTitle>SQL editor</DialogTitle>
                          <DialogDescription>
                            Edit the SQL for this native query.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <CodeMirror
                            aria-label="Expanded SQL editor"
                            value={field.value}
                            height="100%"
                            autoFocus
                            className="h-full overflow-hidden rounded-md border [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
                            theme={editorTheme}
                            extensions={[sql({ dialect: PostgreSQL })]}
                            onChange={field.onChange}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              />
              {form.formState.errors.code && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
          </div>

          <NativeQueryArgumentsSection
            form={form}
            fields={fields}
            watchedArguments={watchedArguments}
            onAdd={() =>
              append({ name: '', type: '', nullable: false, description: '' })
            }
            onRemove={remove}
          />
        </div>

        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className="text-foreground"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <ButtonWithLoading
            type="submit"
            loading={isPending}
            disabled={Boolean(originalName) && !isDirty}
          >
            {originalName ? 'Save' : 'Create'}
          </ButtonWithLoading>
        </div>
      </form>

      <Dialog
        open={isLogicalModelDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            requestLogicalModelDialogClose();
          }
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] min-h-0 w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden text-foreground"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnsTriggerRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Create logical model</DialogTitle>
            <DialogDescription>
              Create the return type for this native query.
            </DialogDescription>
          </DialogHeader>
          {isLogicalModelDialogOpen && (
            <CreateLogicalModelForm
              onCancel={requestLogicalModelDialogClose}
              onCreated={(name) => {
                setValue('returns', name, { shouldDirty: true });
                closeLogicalModelDialog();
              }}
              onDirtyChange={setIsEmbeddedLogicalModelDirty}
            />
          )}
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={showEmbeddedDiscardDialog}
        onOpenChange={setShowEmbeddedDiscardDialog}
        onDiscardChanges={closeLogicalModelDialog}
      />
    </>
  );
}
