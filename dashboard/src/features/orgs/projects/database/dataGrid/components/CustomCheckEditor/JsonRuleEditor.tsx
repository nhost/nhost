import { Check, Copy } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Textarea } from '@/components/ui/v3/textarea';
import {
  type RuleNode,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';

export interface JsonRuleEditorCodec {
  parse: (value: Record<string, unknown>) => unknown;
  serialize: (value: unknown) => Record<string, unknown>;
}

export const defaultJsonRuleEditorCodec: JsonRuleEditorCodec = {
  parse: wrapPermissionsInAGroup,
  serialize(value) {
    if (!value || typeof value !== 'object') {
      return {};
    }

    if (!('type' in value)) {
      return value as Record<string, unknown>;
    }

    return serializeNode(value as RuleNode);
  },
};

export const rawJsonRuleEditorCodec: JsonRuleEditorCodec = {
  parse: (value) => value,
  serialize: (value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
};

export interface JsonRuleEditorProps {
  name: string;
  codec?: JsonRuleEditorCodec;
}

function serializeRule(value: unknown, codec: JsonRuleEditorCodec): string {
  try {
    return JSON.stringify(codec.serialize(value), null, 2);
  } catch {
    return '{}';
  }
}

export default function JsonRuleEditor({
  name,
  codec = defaultJsonRuleEditorCodec,
}: JsonRuleEditorProps) {
  const {
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext();
  const value = watch(name);

  const [draft, setDraft] = useState<string | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayed = draft ?? serializeRule(value, codec);
  const error = errors[name]?.message as string | undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on unmount — name prop and clearErrors reference are stable
  useEffect(
    () => () => {
      clearErrors(name);
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    },
    [],
  );

  function handleCopy() {
    copy(displayed);
    setCopied(true);
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on `displayed` so the textarea resizes whenever its rendered content changes
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    const maxHeight = 384;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    setOverflowing(el.scrollHeight > maxHeight);
  }, [displayed]);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setDraft(next);

    const trimmed = next.trim();
    if (trimmed === '') {
      clearErrors(name);
      setValue(name, codec.parse({}), { shouldDirty: true });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setError(name, { type: 'manual', message: 'Invalid JSON' });
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError(name, {
        type: 'manual',
        message: 'Rule must be a JSON object',
      });
      return;
    }

    try {
      const nextValue = codec.parse(parsed as Record<string, unknown>);
      clearErrors(name);
      setValue(name, nextValue, { shouldDirty: true });
    } catch (codecError) {
      setError(name, {
        type: 'manual',
        message:
          codecError instanceof Error ? codecError.message : 'Invalid rule',
      });
    }
  }

  return (
    <div className="relative mb-2">
      <Textarea
        ref={textareaRef}
        rows={1}
        spellCheck={false}
        value={displayed}
        onChange={handleChange}
        className={cn(
          'min-h-10 resize-none overflow-x-auto whitespace-pre py-2.5 pr-10 font-mono text-xs leading-5',
          overflowing ? 'overflow-y-auto' : 'overflow-y-hidden',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy JSON'}
        className="absolute top-1 right-3 h-7 w-7"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
