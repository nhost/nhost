import { useMemo } from 'react';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';

type Lane = {
  label: string;
  value: string;
  color: string;
  data: number[];
};

function generateSeries(
  seed: number,
  count = 48,
  base = 0.4,
  jitter = 0.7,
): number[] {
  return Array.from({ length: count }, (_, i) => {
    const v =
      base +
      (Math.sin(i / 4 + seed) + Math.sin(i / 1.7 + seed * 0.5)) * jitter * 0.18;
    const noise =
      (Math.sin(i * 13.37 + seed) + Math.cos(i * 4.21 + seed)) * 0.04;
    return Math.max(0, Math.min(1, v + noise));
  });
}

function laneToPath(values: number[]): string {
  return values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${(i / (values.length - 1)).toFixed(4)},${(1 - v).toFixed(4)}`,
    )
    .join(' ');
}

function laneToArea(values: number[]): string {
  return `${laneToPath(values)} L1,1 L0,1 Z`;
}

export default function PulseWidget() {
  const lanes: Lane[] = useMemo(
    () => [
      {
        label: 'Requests',
        value: '142.6 r/s',
        color: 'hsl(var(--primary-main))',
        data: generateSeries(1, 48, 0.42, 0.65),
      },
      {
        label: 'Latency',
        value: '94 ms',
        color: '#FCD34D',
        data: generateSeries(7, 48, 0.5, 0.4),
      },
      {
        label: 'Errors',
        value: '0.12%',
        color: '#FB7185',
        data: generateSeries(13, 48, 0.08, 0.18),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-row place-content-between items-center gap-2 pb-4">
        <Text variant="h3" className="font-medium">
          Project pulse
        </Text>
      </div>
      <Box className="rounded-lg p-4" sx={{ backgroundColor: 'grey.200' }}>
        <ul className="flex flex-col gap-3">
          {lanes.map((lane) => (
            <li
              key={lane.label}
              className="grid grid-cols-[100px_1fr_auto] items-center gap-3"
            >
              <div className="flex flex-col">
                <Text className="font-medium text-sm">{lane.label}</Text>
                <Text variant="body2" color="secondary" className="text-xs">
                  last 4h
                </Text>
              </div>
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="h-9 w-full"
                aria-hidden="true"
              >
                <title>{lane.label} sparkline</title>
                <defs>
                  <linearGradient
                    id={`pulse-grad-${lane.label}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={lane.color}
                      stopOpacity="0.3"
                    />
                    <stop
                      offset="100%"
                      stopColor={lane.color}
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                <path
                  d={laneToArea(lane.data)}
                  fill={`url(#pulse-grad-${lane.label})`}
                />
                <path
                  d={laneToPath(lane.data)}
                  fill="none"
                  stroke={lane.color}
                  strokeWidth="0.012"
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: 1.5 }}
                />
              </svg>
              <Text className="font-mono text-sm tabular-nums">
                {lane.value}
              </Text>
            </li>
          ))}
        </ul>
      </Box>
    </div>
  );
}
