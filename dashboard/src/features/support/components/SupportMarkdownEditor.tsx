import { Bold, Code, Italic, Link } from 'lucide-react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Textarea } from '@/components/ui/v3/textarea';
import SupportMarkdown from '@/features/support/components/SupportMarkdown';
import {
  attachmentValidationError,
  type SupportAttachmentFile,
  type SupportAttachmentScope,
  type SupportAttachmentUploaded,
  supportAttachmentMarkdown,
} from '@/features/support/utils/attachments';
import { cn } from '@/lib/utils';

interface SupportMarkdownEditorProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  filesDisabled?: boolean;
  onFilesDrop?: (
    files: File[],
    onUploaded: SupportAttachmentUploaded,
  ) => Promise<unknown>;
  attachmentScope?: SupportAttachmentScope;
  attachments?: (insert: (file: SupportAttachmentFile) => void) => ReactNode;
}

export default function SupportMarkdownEditor<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  disabled,
  filesDisabled,
  onFilesDrop,
  attachmentScope,
  attachments,
}: SupportMarkdownEditorProps<T>) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const uploadID = useId();
  const nextUpload = useRef(0);
  const { getValues } = useFormContext<T>();
  const [preview, setPreview] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = typeof field.value === 'string' ? field.value : '';
        function formatSelection(before: string, after = before) {
          const textarea = editor.current;
          if (!textarea) {
            return;
          }
          const { selectionStart: start, selectionEnd: end } = textarea;
          field.onChange(
            `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`,
          );
          requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(
              start + before.length,
              end + before.length,
            );
          });
        }
        function insertAttachment(file: SupportAttachmentFile) {
          if (disabled || filesDisabled) {
            return;
          }
          const textarea = editor.current;
          const start = textarea?.selectionStart ?? value.length;
          const end = textarea?.selectionEnd ?? value.length;
          const markdown = supportAttachmentMarkdown(file);
          field.onChange(
            `${value.slice(0, start)}${markdown}${value.slice(end)}`,
          );
          setPreview(false);
          requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(
              start + markdown.length,
              start + markdown.length,
            );
          });
        }
        async function uploadDroppedFiles(files: File[]) {
          if (!onFilesDrop || files.length === 0) {
            return;
          }
          const textarea = editor.current;
          const markers = new Map<File, string>();
          const completed = new Map<File, string>();
          for (const file of files) {
            if (!attachmentValidationError(file)) {
              nextUpload.current += 1;
              markers.set(
                file,
                supportAttachmentMarkdown({
                  id: `upload-${uploadID}-${nextUpload.current}`,
                  name: `Uploading ${file.name}…`,
                }),
              );
            }
          }
          if (markers.size > 0) {
            const start = textarea?.selectionStart ?? value.length;
            const end = textarea?.selectionEnd ?? value.length;
            const pending = [...markers.values()].join('\n');
            const pendingValue = `${value.slice(0, start)}${pending}${value.slice(end)}`;
            field.onChange(pendingValue);
            requestAnimationFrame(() => {
              if (
                textarea &&
                !textarea.hidden &&
                textarea.value === pendingValue
              ) {
                textarea.focus();
                textarea.setSelectionRange(
                  start + pending.length,
                  start + pending.length,
                );
              }
            });
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
            // Replace tokens in the latest text so typing during uploads is never overwritten.
            const current = getValues(name);
            if (typeof current === 'string') {
              let updated: string = current;
              let start = textarea?.selectionStart ?? current.length;
              let end = textarea?.selectionEnd ?? current.length;
              for (const [source, marker] of markers) {
                const position = updated.indexOf(marker);
                if (position < 0) {
                  continue;
                }
                const replacement = completed.get(source) ?? '';
                const adjust = (offset: number) =>
                  offset <= position
                    ? offset
                    : offset >= position + marker.length
                      ? offset + replacement.length - marker.length
                      : position + replacement.length;
                start = adjust(start);
                end = adjust(end);
                updated = `${updated.slice(0, position)}${replacement}${updated.slice(position + marker.length)}`;
              }
              if (updated !== current) {
                field.onChange(updated);
                requestAnimationFrame(() => {
                  if (
                    textarea &&
                    document.activeElement === textarea &&
                    textarea.value === updated
                  ) {
                    textarea.setSelectionRange(start, end);
                  }
                });
              }
            }
          }
        }
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={!preview}
                onClick={() => setPreview(false)}
              >
                Write
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={preview}
                onClick={() => setPreview(true)}
              >
                Preview
              </Button>
              {!preview && (
                <>
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
                </>
              )}
            </div>
            <FormControl>
              <Textarea
                {...field}
                value={value}
                ref={mergeRefs([field.ref, editor])}
                placeholder={placeholder}
                hidden={preview}
                disabled={disabled}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) {
                    return;
                  }
                  event.preventDefault();
                  const allowed = !!onFilesDrop && !disabled && !filesDisabled;
                  const transfer = event.dataTransfer;
                  transfer.dropEffect = allowed ? 'copy' : 'none';
                  setDragging(allowed);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) {
                    return;
                  }
                  event.preventDefault();
                  setDragging(false);
                  if (!disabled && !filesDisabled && onFilesDrop) {
                    void uploadDroppedFiles(
                      Array.from(event.dataTransfer.files),
                    );
                  }
                }}
                className={cn(
                  'min-h-40 font-mono',
                  preview && 'hidden',
                  dragging && 'border-primary ring-2 ring-primary/30',
                )}
              />
            </FormControl>
            {preview && (
              <section
                aria-label={`${label} preview`}
                className="min-h-40 rounded-md border p-4"
              >
                {value.trim() ? (
                  <SupportMarkdown attachmentScope={attachmentScope}>
                    {value}
                  </SupportMarkdown>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nothing to preview.
                  </p>
                )}
              </section>
            )}
            <FormDescription>
              Markdown supported: headings, lists, links, tables and fenced code
              blocks. Drop files here to upload and insert links or images
              automatically (up to 5 MB each). Attachment buttons can insert
              existing files. HTML and remote images are disabled.
            </FormDescription>
            <FormMessage />
            {attachments?.(insertAttachment)}
          </FormItem>
        );
      }}
    />
  );
}
