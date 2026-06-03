import {
  type GetSmartEdgeOptions,
  getSmartEdge,
  pathfindingAStarDiagonal,
  pathfindingJumpPointNoDiagonal,
  svgDrawStraightLinePath,
} from '@tisoap/react-flow-smart-edge';
import {
  BaseEdge,
  type EdgeProps,
  getSmoothStepPath,
  type Node,
  useNodes,
} from '@xyflow/react';

// The library's `SmartStepEdge` renders the orthogonal, node-avoiding route —
// but when its pathfinding can't find a way through, it silently falls back to
// a plain `StepEdge` that ignores every node and slices straight through
// whatever is in the way. Tall table cards hit this most: routing around a tall
// obstacle needs vertical clearance the orthogonal grid sometimes can't find.
//
// This edge keeps the identical look (orthogonal, sharp corners, perpendicular
// endpoints) but escalates instead of surrendering: orthogonal Jump Point
// Search first, then a diagonal A* pass that can still route *around* the card
// (at the cost of the occasional 45° segment), and only if both genuinely find
// no route does it draw a smooth-step line as a last resort.

// Extra breathing room between edges and card walls. Kept well under half the
// dagre `nodesep` (60px) so the vertical channels between stacked cards stay
// wide enough for the router to thread: 60 − 2×20 = 20px (≈2 grid cells).
const NODE_PADDING = 20;

const ORTHOGONAL: GetSmartEdgeOptions = {
  drawEdge: svgDrawStraightLinePath,
  generatePath: pathfindingJumpPointNoDiagonal,
  nodePadding: NODE_PADDING,
};

const DIAGONAL: GetSmartEdgeOptions = {
  drawEdge: svgDrawStraightLinePath,
  generatePath: pathfindingAStarDiagonal,
  nodePadding: NODE_PADDING,
};

// The diagram controls its nodes (`nodes={styledNodes}`) and never feeds React
// Flow's measured dimensions back through `onNodesChange`, so every node the
// pathfinder sees has `measured === undefined` — which the library floors to a
// 1×1px obstacle, leaving the routing grid effectively empty (edges then cut
// straight through cards). Restore each obstacle box from the card's own
// `initialWidth`/`initialHeight` — the rendered size `useSchemaGraph` stamps
// from its visible rows (columns, plus computed fields only in GraphQL mode).
// That deliberately differs from the height the dagre layout reserves, which
// always counts the GraphQL computed-field rows (even in postgres mode, where
// they're hidden) to keep positions stable across the naming toggle. `Math.max`
// keeps any real measurement if React Flow ever does provide one.
function withObstacleSizes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    measured: {
      width: Math.max(node.measured?.width ?? 0, node.initialWidth ?? 0),
      height: Math.max(node.measured?.height ?? 0, node.initialHeight ?? 0),
    },
  }));
}

function smartPath(params: Parameters<typeof getSmartEdge>[0]): string | null {
  const result = getSmartEdge(params);
  return result instanceof Error ? null : result.svgPathString;
}

export default function TableEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
}: EdgeProps) {
  const nodes = withObstacleSizes(useNodes());
  const geometry = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };

  const path =
    smartPath({ ...geometry, nodes, options: ORTHOGONAL }) ??
    smartPath({ ...geometry, nodes, options: DIAGONAL }) ??
    getSmoothStepPath(geometry)[0];

  return (
    <BaseEdge
      path={path}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
    />
  );
}
