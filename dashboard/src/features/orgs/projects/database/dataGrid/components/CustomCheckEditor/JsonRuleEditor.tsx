import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Textarea } from '@/components/ui/v3/textarea';
import {
  type RuleNode,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';

export interface JsonRuleEditorProps {
  name: string;
}

function serializeRule(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '{}';
  }

  if (!('type' in (value as object))) {
    return JSON.stringify(value, null, 2);
  }

  try {
    return JSON.stringify(serializeNode(value as RuleNode), null, 2);
  } catch {
    return '{}';
  }
}

export default function JsonRuleEditor({ name }: JsonRuleEditorProps) {
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const displayed = draft ?? serializeRule(value);
  const error = errors[name]?.message as string | undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on unmount — name prop and clearErrors reference are stable
  useEffect(
    () => () => {
      clearErrors(name);
    },
    [],
  );

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
      setValue(name, wrapPermissionsInAGroup({}), { shouldDirty: true });
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

    const tree = wrapPermissionsInAGroup(parsed as Record<string, unknown>);
    clearErrors(name);
    setValue(name, tree, { shouldDirty: true });
  }

  return (
    <div className="mb-2">
      <Textarea
        ref={textareaRef}
        rows={1}
        spellCheck={false}
        value={displayed}
        onChange={handleChange}
        className={cn(
          'min-h-10 resize-none overflow-x-auto whitespace-pre py-2.5 font-mono text-xs leading-5',
          overflowing ? 'overflow-y-auto' : 'overflow-y-hidden',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      />
    </div>
  );
}
