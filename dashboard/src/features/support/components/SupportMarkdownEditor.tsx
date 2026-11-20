import { Bold, Code, Italic, Link } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
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
import { cn } from '@/lib/utils';

interface SupportMarkdownEditorProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function SupportMarkdownEditor<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  disabled,
}: SupportMarkdownEditorProps<T>) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

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
                className={cn('min-h-40 font-mono', preview && 'hidden')}
              />
            </FormControl>
            {preview && (
              <section
                aria-label={`${label} preview`}
                className="min-h-40 rounded-md border p-4"
              >
                {value.trim() ? (
                  <SupportMarkdown>{value}</SupportMarkdown>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nothing to preview.
                  </p>
                )}
              </section>
            )}
            <FormDescription>
              Markdown supported: headings, lists, links, tables and fenced code
              blocks. HTML and embedded images are disabled.
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
