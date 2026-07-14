import { ChevronRight, CornerDownLeft } from 'lucide-react';

import { CommandItem } from '@/components/ui/v3/command';
import { isContainer } from '@/features/command-palette/lib/machine';
import { isExternalNode } from '@/features/command-palette/lib/resolvePath';
import type { ScoredNode } from '@/features/command-palette/types';

export interface CommandRowProps {
  item: ScoredNode;
  onSelect: (node: ScoredNode['node']) => void;
  selected?: boolean;
}

interface HighlightedTitleProps {
  title: string;
  ranges: ScoredNode['titleRanges'];
}

const kindLabels: Record<ScoredNode['node']['kind'], string> = {
  page: 'Page',
  group: 'Group',
  setting: 'Setting',
  org: 'Org',
  project: 'Project',
  doc: 'Doc',
};

const keyHintClassName =
  'inline-flex h-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[11px] text-muted-foreground';

const splitTitle = (title: string, ranges: ScoredNode['titleRanges']) => {
  if (ranges.length === 0) {
    return [{ key: `plain-${title}`, text: title, highlighted: false }];
  }

  const segments: Array<{ key: string; text: string; highlighted: boolean }> =
    [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      segments.push({
        key: `${cursor}-${start}-plain`,
        text: title.slice(cursor, start),
        highlighted: false,
      });
    }

    segments.push({
      key: `${start}-${end}-highlight`,
      text: title.slice(start, end),
      highlighted: true,
    });
    cursor = end;
  }

  if (cursor < title.length) {
    segments.push({
      key: `${cursor}-${title.length}-plain`,
      text: title.slice(cursor),
      highlighted: false,
    });
  }

  return segments;
};

const HighlightedTitle = ({ title, ranges }: HighlightedTitleProps) => (
  <span>
    {splitTitle(title, ranges).map((segment) =>
      segment.highlighted ? (
        <mark
          className="-mx-0.5 rounded-sm bg-accent px-0.5 text-accent-foreground"
          data-testid="command-palette-title-highlight"
          key={segment.key}
        >
          {segment.text}
        </mark>
      ) : (
        <span key={segment.key}>{segment.text}</span>
      ),
    )}
  </span>
);

const getTrail = (node: ScoredNode['node']) => {
  if (node.breadcrumb?.length) {
    return [...node.breadcrumb, node.title].join(' › ');
  }

  return isExternalNode(node) ? node.path : undefined;
};

export const CommandRow = ({
  item,
  onSelect,
  selected = false,
}: CommandRowProps) => {
  const { node, titleRanges } = item;
  const trail = getTrail(node);

  return (
    <CommandItem
      className="gap-3 px-3 py-2"
      data-testid={`command-palette-item-${node.id}`}
      onSelect={() => onSelect(node)}
      value={node.id}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
        {node.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          <HighlightedTitle ranges={titleRanges} title={node.title} />
        </span>
        {(node.hint || trail) && (
          <span className="block truncate text-muted-foreground text-xs">
            {node.hint && <span>{node.hint}</span>}
            {node.hint && trail && <span aria-hidden="true"> · </span>}
            {trail && <span>{trail}</span>}
          </span>
        )}
      </span>
      {selected ? (
        <span
          aria-hidden="true"
          className="ml-auto flex shrink-0 items-center gap-3 text-muted-foreground text-xs"
        >
          {node.path !== undefined && (
            <span className="flex items-center gap-1">
              <kbd className={keyHintClassName}>Enter</kbd>
              <span>to jump to</span>
            </span>
          )}
          {isContainer(node) && (
            <span className="flex items-center gap-1">
              <kbd className={keyHintClassName}>Tab</kbd>
              <span>to search</span>
            </span>
          )}
        </span>
      ) : (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
            {kindLabels[node.kind]}
          </span>
          {(node.path !== undefined || !isContainer(node)) && (
            <CornerDownLeft
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          {isContainer(node) && (
            <ChevronRight
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </span>
      )}
    </CommandItem>
  );
};
