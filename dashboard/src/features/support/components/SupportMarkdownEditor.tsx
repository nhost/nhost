import { Bold, Code, Italic, Link, Paperclip } from 'lucide-react';
import { type ReactNode, useId, useRef, useState } from 'react';
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useFormContext,
} from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import { Button } from '@/components/ui/v3/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Separator } from '@/components/ui/v3/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import SupportAttachmentEditor, {
  type SupportEditorHandle,
} from '@/features/support/components/SupportAttachmentEditor';
import {
  attachmentValidationError,
  SUPPORT_ATTACHMENT_TOKEN_PATTERN,
  type SupportAttachmentFile,
  type SupportAttachmentScope,
  type SupportAttachmentUploaded,
  supportAttachmentId,
  supportAttachmentMarkdown,
} from '@/features/support/utils/attachments';

export type RemoveSupportAttachmentTokens = (target?: {
  id?: string;
  file?: File;
}) => void;

interface SupportMarkdownEditorProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  filesDisabled?: boolean;
  organizationRequired?: boolean;
  attachmentPickerInFooter?: boolean;
  replySubmit?: ReactNode;
  onDiscardInlineAttachment?: (id: string) => Promise<boolean>;
  onFilesDrop?: (
    files: File[],
    onUploaded: SupportAttachmentUploaded,
  ) => Promise<unknown>;
  attachmentScope?: SupportAttachmentScope;
  attachments?: (
    insert: (file: SupportAttachmentFile) => void,
    uploadFiles: (files: File[]) => Promise<void>,
    remove: RemoveSupportAttachmentTokens,
    focusAttach: VoidFunction,
  ) => ReactNode;
}

export default function SupportMarkdownEditor<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  filesDisabled,
  organizationRequired = false,
  attachmentPickerInFooter = false,
  replySubmit,
  onDiscardInlineAttachment,
  onFilesDrop,
  attachmentScope,
  attachments,
}: SupportMarkdownEditorProps<T>) {
  const editor = useRef<SupportEditorHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const attachButton = useRef<HTMLButtonElement>(null);
  const activeMarkers = useRef(new Map<File, string>());
  const uploadPrefix = `upload-${useId()}-`;
  const attachmentsDisabled =
    !!disabled || !!filesDisabled || organizationRequired;
  const attachTooltip = organizationRequired
    ? 'Pick an organization'
    : 'Attach files';
  const nextUpload = useRef(0);
  const { getValues } = useFormContext<T>();
  const [dragging, setDragging] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = typeof field.value === 'string' ? field.value : '';
        function formatSelection(before: string, after = before) {
          const view = editor.current?.view;
          if (!view || disabled) {
            return;
          }
          const { from, to } = view.state.selection.main;
          const selected = view.state.doc.sliceString(from, to);
          view.dispatch({
            changes: { from, to, insert: `${before}${selected}${after}` },
            selection: {
              anchor: from + before.length,
              head: from + before.length + selected.length,
            },
            userEvent: 'input',
          });
          view.focus();
        }
        function insertMarkdown(markdown: string, position?: number | null) {
          const view = editor.current?.view;
          if (!view) {
            return;
          }
          const { from, to } = view.state.selection.main;
          const start = position ?? from;
          const end = position == null ? to : start;
          const doc = view.state.doc;
          const before =
            start > 0 && doc.sliceString(start - 1, start) !== '\n' ? '\n' : '';
          const after =
            end < doc.length && doc.sliceString(end, end + 1) !== '\n'
              ? '\n'
              : '';
          const insert = `${before}${markdown}\n${after}`;
          view.dispatch({
            changes: { from: start, to: end, insert },
            selection: { anchor: start + insert.length },
            userEvent: 'input',
          });
          view.focus();
        }
        function insertAttachment(file: SupportAttachmentFile) {
          if (disabled || filesDisabled) {
            return;
          }
          insertMarkdown(supportAttachmentMarkdown(file));
        }
        const remove: RemoveSupportAttachmentTokens = (target) => {
          const view = editor.current?.view;
          if (!view || view.state.readOnly) {
            return;
          }
          const pendingID =
            target?.file && activeMarkers.current.get(target.file);
          const changes = Array.from(
            view.state.doc
              .toString()
              .matchAll(SUPPORT_ATTACHMENT_TOKEN_PATTERN),
          ).flatMap((match) => {
            const id = match[3];
            const shouldRemove = target
              ? id === target.id || id === pendingID
              : id.startsWith(uploadPrefix) ||
                !!supportAttachmentId(`attachment:${id}`);
            return shouldRemove
              ? [{ from: match.index, to: match.index + match[0].length }]
              : [];
          });
          if (changes.length > 0) {
            view.dispatch({ changes, userEvent: 'support.removeAttachment' });
          }
        };
        async function uploadDroppedFiles(
          files: File[],
          position?: number | null,
        ) {
          if (!onFilesDrop || attachmentsDisabled || files.length === 0) {
            return;
          }
          const markers = new Map<File, string>();
          const completed = new Map<File, string>();
          for (const file of files) {
            if (!attachmentValidationError(file)) {
              nextUpload.current += 1;
              const id = `${uploadPrefix}${nextUpload.current}`;
              activeMarkers.current.set(file, id);
              markers.set(
                file,
                supportAttachmentMarkdown({
                  id,
                  name: `Uploading ${file.name}…`,
                }),
              );
            }
          }
          if (markers.size > 0) {
            insertMarkdown([...markers.values()].join('\n'), position);
          }
          try {
            await onFilesDrop(files, (attachment, source) => {
              completed.set(source, supportAttachmentMarkdown(attachment));
            });
          } catch (error: unknown) {
            console.error(
              'Dropped attachment upload failed',
              error instanceof Error ? error.message : 'Unknown error',
            );
          } finally {
            for (const file of markers.keys()) {
              activeMarkers.current.delete(file);
            }
            // Resolve markers against the live document, preserving edits and selection during uploads.
            const view = editor.current?.view;
            const current = view?.state.doc.toString() ?? getValues(name);
            if (typeof current === 'string') {
              const changes = [...markers]
                .flatMap(([source, marker]) => {
                  const from = current.indexOf(marker);
                  return from < 0
                    ? []
                    : [
                        {
                          from,
                          to: from + marker.length,
                          insert: completed.get(source) ?? '',
                        },
                      ];
                })
                .sort((a, b) => a.from - b.from);
              if (view && changes.length > 0) {
                view.dispatch({ changes });
              } else if (!view) {
                let updated = current;
                for (const [source, marker] of markers) {
                  updated = updated.replace(
                    marker,
                    () => completed.get(source) ?? '',
                  );
                }
                if (updated !== current) {
                  field.onChange(updated);
                }
              }
            }
          }
        }
        const picker = onFilesDrop && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0">
                  <Button
                    ref={attachButton}
                    type="button"
                    variant={attachmentPickerInFooter ? 'link' : 'ghost'}
                    size="sm"
                    className={
                      attachmentPickerInFooter
                        ? 'h-auto cursor-pointer whitespace-nowrap p-0 text-xs hover:text-foreground'
                        : undefined
                    }
                    aria-label="Attach files"
                    disabled={attachmentsDisabled}
                    onClick={() => fileInput.current?.click()}
                  >
                    {attachmentPickerInFooter ? (
                      replySubmit ? 'Attach' : 'browse'
                    ) : (
                      <Paperclip aria-hidden="true" className="size-4" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{attachTooltip}</TooltipContent>
            </Tooltip>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              disabled={attachmentsDisabled}
              aria-label="Choose attachments"
              onChange={(event) => {
                const input = event.currentTarget;
                const files = Array.from(input.files ?? []);
                input.value = '';
                void uploadDroppedFiles(files);
              }}
            />
          </>
        );
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex flex-wrap items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Bold"
                    disabled={disabled}
                    onClick={() => formatSelection('**')}
                  >
                    <Bold className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Italic"
                    disabled={disabled}
                    onClick={() => formatSelection('_')}
                  >
                    <Italic className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Code"
                    disabled={disabled}
                    onClick={() => formatSelection('`')}
                  >
                    <Code className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Code</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Insert link"
                    disabled={disabled}
                    onClick={() => formatSelection('[', '](https://)')}
                  >
                    <Link className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Link</TooltipContent>
              </Tooltip>
              {!attachmentPickerInFooter && picker && (
                <div className="flex items-center gap-1">
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  {picker}
                </div>
              )}
            </div>
            <FormControl>
              <SupportAttachmentEditor
                ref={mergeRefs([field.ref, editor])}
                value={value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                label={label}
                disabled={disabled}
                dragging={dragging}
                scope={attachmentScope}
                uploadPrefix={uploadPrefix}
                onFormat={formatSelection}
                filesDisabled={attachmentsDisabled || !onFilesDrop}
                organizationRequired={organizationRequired}
                onDiscardAttachment={
                  onDiscardInlineAttachment
                    ? async (id) => {
                        if (await onDiscardInlineAttachment(id)) {
                          remove({ id });
                          editor.current?.focus();
                        }
                      }
                    : undefined
                }
                footer={
                  attachmentPickerInFooter &&
                  picker && (
                    <div className="flex w-full flex-wrap items-center gap-2 rounded-b-md border-input border-t bg-background px-3 py-2 text-muted-foreground text-xs">
                      <Paperclip
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                      <div>
                        {replySubmit ? (
                          <>{picker} files up to 5 MB</>
                        ) : (
                          <><span>Drag files here</span> or {picker}. Up to 5 MB each.</>
                        )}
                      </div>
                      {replySubmit && <div className="ml-auto">{replySubmit}</div>}
                    </div>
                  )
                }
                onFilesDrop={(files, position) => {
                  void uploadDroppedFiles(files, position);
                }}
                onDraggingChange={setDragging}
              />
            </FormControl>
            <FormMessage />
            {attachments?.(insertAttachment, uploadDroppedFiles, remove, () => {
              attachButton.current?.focus();
            })}
          </FormItem>
        );
      }}
    />
  );
}
