const REFERENCE_LABEL_GAP = 6;

function verticalReferenceLabelAnchor(
  timestamp: number,
  timeDomain: [number, number] | undefined,
): 'start' | 'end' {
  if (!timeDomain) {
    return 'end';
  }
  const midpoint = timeDomain[0] + (timeDomain[1] - timeDomain[0]) / 2;
  return timestamp <= midpoint ? 'start' : 'end';
}

interface VerticalReferenceLineLabelProps {
  value: string;
  timestamp: number;
  timeDomain?: [number, number];
  viewBox?: { x?: number; y?: number };
}

// Recharts' built-in `top` position gives vertical-line labels a zero width,
// which wraps every word onto its own line, so the label is drawn directly.
export default function VerticalReferenceLineLabel({
  value,
  timestamp,
  timeDomain,
  viewBox,
}: VerticalReferenceLineLabelProps) {
  if (viewBox?.x == null || viewBox.y == null) {
    return null;
  }
  return (
    <text
      x={viewBox.x}
      y={viewBox.y - REFERENCE_LABEL_GAP}
      textAnchor={verticalReferenceLabelAnchor(timestamp, timeDomain)}
      fill="hsl(var(--muted-foreground))"
      fontSize={12}
    >
      {value}
    </text>
  );
}
