import { ChevronRight, CornerDownLeft } from 'lucide-react';

import { CommandItem, CommandShortcut } from '@/components/ui/v3/command';
import type { ScoredNode } from '@/features/command-palette/types';
import { cn } from '@/lib/utils';

export interface CommandRowProps {
  item: ScoredNode;
  onSelect: (node: ScoredNode['node']) => void;
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

export const CommandRow = ({ item, onSelect }: CommandRowProps) => {
  const { node, titleRanges } = item;
  const isContainer = (node.children?.length ?? 0) > 0;

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
        {(node.hint || node.path) && (
          <span className="block truncate text-muted-foreground text-xs">
            {node.hint ?? node.path}
          </span>
        )}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {node.shortcut && <CommandShortcut>{node.shortcut}</CommandShortcut>}
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
          {kindLabels[node.kind]}
        </span>
        {isContainer ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <CornerDownLeft
            className={cn('h-4 w-4 text-muted-foreground')}
            aria-hidden="true"
          />
        )}
      </span>
    </CommandItem>
  );
};
