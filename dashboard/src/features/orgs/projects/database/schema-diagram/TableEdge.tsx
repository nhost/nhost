import {
  type GetSmartEdgeOptions,
  getSmartEdge,
  pathfindingJumpPointNoDiagonal,
  svgDrawStraightLinePath,
} from '@tisoap/react-flow-smart-edge';
import { BaseEdge, type EdgeProps, StepEdge, useNodes } from '@xyflow/react';

// Same step routing as the library's `SmartStepEdge`, but `SmartStepEdge`
// hardcodes the default 10px `nodePadding` and exposes no way to change it, so
// we drive `getSmartEdge` directly to keep the wider clearance the diagram
// needs. Obstacle sizes come from each node's `measured`, which `useSchemaGraph`
// stamps. Falls back to a plain `StepEdge` (exactly as `SmartStepEdge` does) on
// the rare occasion no orthogonal route is found.
const NODE_PADDING = 20;

const STEP_OPTIONS: GetSmartEdgeOptions = {
  drawEdge: svgDrawStraightLinePath,
  generatePath: pathfindingJumpPointNoDiagonal,
  nodePadding: NODE_PADDING,
};

export default function TableEdge(props: EdgeProps) {
  const nodes = useNodes();
  const {
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
  } = props;

  const result = getSmartEdge({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    nodes,
    options: STEP_OPTIONS,
  });

  if (result instanceof Error) {
    return <StepEdge {...props} />;
  }

  return (
    <BaseEdge
      path={result.svgPathString}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
    />
  );
}
