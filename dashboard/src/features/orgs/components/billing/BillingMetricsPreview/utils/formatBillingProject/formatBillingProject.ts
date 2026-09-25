const SHORT_ID_HEAD_LENGTH = 8;
const SHORT_ID_TAIL_LENGTH = 4;

export function shortenProjectID(projectID: string): string {
  return `${projectID.slice(0, SHORT_ID_HEAD_LENGTH)}…${projectID.slice(-SHORT_ID_TAIL_LENGTH)}`;
}

export function formatDeletedProjectLabel(projectID: string): string {
  return `Deleted · ${shortenProjectID(projectID)}`;
}

export function formatDeletedProjectsGroupLabel(count: number): string {
  return `Deleted projects (${count})`;
}

export function formatDeletedProjectCount(count: number): string {
  return `${count} deleted ${count === 1 ? 'project' : 'projects'}`;
}

export function formatUsageShare(percentage: number): string {
  return percentage < 1 ? '<1%' : `${percentage}%`;
}
