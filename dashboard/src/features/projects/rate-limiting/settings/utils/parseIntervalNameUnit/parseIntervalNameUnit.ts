export default function parseIntervalNameUnit(interval: string) {
  if (!interval) {
    return {};
  }
  const regex = /^(\d+)([a-zA-Z])$/;
  const match = interval.match(regex);

  if (!match) {
    return {};
  }

  const [, intervalValue, intervalUnit] = match;

  return {
    interval: parseInt(intervalValue, 10),
    intervalUnit,
  };
}
