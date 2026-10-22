export default function formatUsageShare(percentage: number): string {
  return percentage < 1 ? '<1%' : `${percentage}%`;
}
