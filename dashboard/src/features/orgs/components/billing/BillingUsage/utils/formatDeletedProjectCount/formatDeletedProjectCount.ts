export default function formatDeletedProjectCount(count: number): string {
  return `${count} deleted ${count === 1 ? 'project' : 'projects'}`;
}
