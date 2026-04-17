import { useFormContext } from 'react-hook-form';
import {
  isConditionNode,
  isExistsNode,
  isInvalidNode,
  isRelationshipNode,
  type RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { useCustomCheckMode } from './CustomCheckModeProvider';

export interface FilterErrorsSummaryProps {
  name: string;
}

interface CollectedError {
  path: string;
  message: string;
  type?: string;
}

function nodeHeader(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  const tree = node as RuleNode;
  if (isConditionNode(tree)) {
    const column = tree.column || '[column]';
    const operator = tree.operator || '[operator]';
    return `${column} ${operator}`;
  }
  if (isRelationshipNode(tree)) {
    return tree.relationship || '[relationship]';
  }
  if (isExistsNode(tree)) {
    return tree.schema && tree.table
      ? `exists in ${tree.schema}.${tree.table}`
      : 'exists';
  }
  if (isInvalidNode(tree)) {
    return tree.key || 'invalid';
  }
  return '';
}

function collect(
  errors: unknown,
  tree: unknown,
  prefix: string[],
  out: CollectedError[],
): void {
  if (!errors || typeof errors !== 'object') {
    return;
  }

  const record = errors as Record<string, unknown>;

  if (typeof record.message === 'string' && record.message.length > 0) {
    const header = nodeHeader(tree);
    const path = [...prefix, header].filter(Boolean).join(' → ');
    out.push({
      path,
      message: record.message,
      type: typeof record.type === 'string' ? record.type : undefined,
    });
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'message' || key === 'type' || key === 'ref') {
      continue;
    }

    if (key === 'root') {
      collect(value, tree, prefix, out);
      continue;
    }

    if (key === 'children' && Array.isArray(value)) {
      const treeChildren = (tree as { children?: unknown[] })?.children ?? [];
      for (let i = 0; i < value.length; i += 1) {
        if (value[i]) {
          collect(value[i], treeChildren[i], prefix, out);
        }
      }
      continue;
    }

    if (key === 'child') {
      const header = nodeHeader(tree);
      const nextPrefix = header ? [...prefix, header] : prefix;
      const nextTree = (tree as { child?: unknown })?.child;
      collect(value, nextTree, nextPrefix, out);
      continue;
    }

    if (key === 'where') {
      const header = nodeHeader(tree);
      const nextPrefix = header ? [...prefix, header] : prefix;
      const nextTree = (tree as { where?: unknown })?.where;
      collect(value, nextTree, nextPrefix, out);
      continue;
    }

    collect(value, tree, prefix, out);
  }
}

export default function FilterErrorsSummary({
  name,
}: FilterErrorsSummaryProps) {
  const {
    formState: { errors },
    getValues,
  } = useFormContext();
  const { mode } = useCustomCheckMode();

  const collected: CollectedError[] = [];
  collect(errors[name], getValues(name), [], collected);

  const visible =
    mode === 'json' ? collected : collected.filter(({ path }) => !path);

  if (visible.length === 0) {
    return null;
  }

  return (
    <ul className="mb-2 list-disc pl-5 text-destructive text-sm" role="alert">
      {visible.map(({ path, message, type }) => {
        const displayMessage =
          mode === 'json' && type === 'no-serialization-collisions'
            ? `${message} Switch to Visual to find and remove the duplicate.`
            : message;
        return (
          <li key={`${path}:${message}`}>
            {path ? (
              <>
                <span className="font-medium">{path}</span>: {displayMessage}
              </>
            ) : (
              displayMessage
            )}
          </li>
        );
      })}
    </ul>
  );
}
