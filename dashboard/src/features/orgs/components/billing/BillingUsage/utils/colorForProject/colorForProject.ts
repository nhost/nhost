import { hashString } from '@/utils/hashString';

export default function colorForProject(
  labels: Record<string, string>,
): string {
  if (labels.projectKind === 'deletedGroup') {
    return 'color-mix(in srgb, hsl(var(--muted-foreground)) 55%, hsl(var(--card)))';
  }
  const hue = hashString(labels.projectID) % 360;
  return labels.projectKind === 'deleted'
    ? `hsl(${hue} 20% 60%)`
    : `hsl(${hue} 65% 50%)`;
}
