import type { Edge, Node } from '@xyflow/react';
import dagre from 'dagre';

export const TABLE_NODE_WIDTH = 280;

export interface LayoutOptions {
  nodeWidth?: number;
  rowHeight?: number;
  headerHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export function computeNodeHeight(
  columnCount: number,
  options?: Pick<LayoutOptions, 'headerHeight' | 'rowHeight'>,
): number {
  const headerHeight = options?.headerHeight ?? 44;
  const rowHeight = options?.rowHeight ?? 26;
  return headerHeight + Math.max(1, columnCount) * rowHeight + 8;
}

export function layoutNodes<TNode extends Node, TEdge extends Edge>(
  nodes: TNode[],
  edges: TEdge[],
  columnCountByNodeId: Map<string, number>,
  options: LayoutOptions = {},
): TNode[] {
  const nodeWidth = options.nodeWidth ?? TABLE_NODE_WIDTH;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    ranksep: options.rankSep ?? 220,
    nodesep: options.nodeSep ?? 60,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const columnCount = columnCountByNodeId.get(node.id) ?? 0;
    g.setNode(node.id, {
      width: nodeWidth,
      height: computeNodeHeight(columnCount, options),
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const positioned = g.node(node.id);
    const columnCount = columnCountByNodeId.get(node.id) ?? 0;
    const height = computeNodeHeight(columnCount, options);

    return {
      ...node,
      position: {
        x: positioned.x - nodeWidth / 2,
        y: positioned.y - height / 2,
      },
    };
  });
}
