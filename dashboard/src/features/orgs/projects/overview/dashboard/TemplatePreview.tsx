import type {
  DashboardLayout,
  LayoutItem,
} from '@/features/orgs/projects/overview/dashboard/types';

const METRIC_PRESETS: Record<
  string,
  { label: string; value: string; accent: string }
> = {
  rps: { label: 'Req/s', value: '1.2k', accent: '#FF8B5C' },
  dau: { label: 'DAU', value: '8,431', accent: '#5EA3FF' },
  reqs: { label: 'Requests', value: '4.1M', accent: '#7CDB9A' },
  storage: { label: 'Storage', value: '218 GB', accent: '#C58BFF' },
};

const TPL_TITLES: Record<string, string | Record<string, string>> = {
  metric: {
    rps: 'Requests',
    dau: 'Active users',
    reqs: 'Total reqs',
    storage: 'Storage',
  },
  pulse: 'Live pulse',
  health: 'Service health',
  deploys: 'Deployments',
  info: 'Project info',
  logs: 'Logs',
  repo: 'Repository',
  docs: 'Documentation',
};

function MetricMini({ cfg }: { cfg: LayoutItem['cfg'] }) {
  const preset = METRIC_PRESETS[cfg.metric ?? 'rps'] ?? {
    label: 'Metric',
    value: '—',
    accent: '#FF8B5C',
  };
  return (
    <>
      <div
        className="font-semibold text-[5.5px] uppercase tracking-wider"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        {preset.label}
      </div>
      <div
        className="font-bold text-[14px] leading-none tracking-tight"
        style={{ color: preset.accent, marginTop: 2 }}
      >
        {preset.value}
      </div>
      <svg
        viewBox="0 0 60 16"
        preserveAspectRatio="none"
        className="mt-auto h-4 w-full opacity-90"
        aria-hidden="true"
      >
        <title>Sparkline</title>
        <path
          d="M0 12 L8 9 L16 11 L24 6 L32 8 L40 4 L48 5 L60 2"
          fill="none"
          stroke={preset.accent}
          strokeWidth="1.2"
        />
      </svg>
    </>
  );
}

function PulseMini() {
  return (
    <svg
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      className="block h-full w-full"
      aria-hidden="true"
    >
      <title>Pulse preview</title>
      <defs>
        <linearGradient id="tpl-pulse-fill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="hsl(var(--primary-main))"
            stopOpacity="0.45"
          />
          <stop
            offset="100%"
            stopColor="hsl(var(--primary-main))"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <path
        d="M0 45 C 18 38, 28 25, 44 32 S 70 50, 88 38 S 120 18, 140 28 S 175 48, 200 30 L 200 60 L 0 60 Z"
        fill="url(#tpl-pulse-fill)"
      />
      <path
        d="M0 45 C 18 38, 28 25, 44 32 S 70 50, 88 38 S 120 18, 140 28 S 175 48, 200 30"
        fill="none"
        stroke="hsl(var(--primary-main))"
        strokeWidth="1.4"
      />
    </svg>
  );
}

type RowStatus = 'ok' | 'warn' | 'err' | 'mute';
function RowsMini({
  rows,
}: {
  rows: { status?: RowStatus; w: number; tag?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((r, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order, tiny preview
          key={i}
          className="flex h-[4px] items-center gap-[3px]"
        >
          <span
            className="h-[4px] w-[4px] shrink-0 rounded-full"
            style={{
              background:
                r.status === 'warn'
                  ? '#FCD34D'
                  : r.status === 'err'
                    ? '#F87171'
                    : r.status === 'mute'
                      ? 'hsl(var(--secondary-300))'
                      : '#7CDB9A',
            }}
          />
          <span
            className="h-[2px] rounded-[1px]"
            style={{
              width: `${r.w}%`,
              background: 'hsl(var(--secondary-300))',
              opacity: 0.65,
            }}
          />
          {r.tag ? (
            <span
              className="h-[4px] w-[12px] shrink-0 rounded-[1px]"
              style={{
                background: 'hsl(var(--secondary-200))',
                opacity: 0.55,
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LogsMini() {
  const sevs: ('info' | 'warn' | 'err')[] = [
    'info',
    'warn',
    'info',
    'err',
    'info',
    'info',
    'warn',
    'info',
  ];
  const widths = [78, 64, 88, 56, 82, 70, 60, 74];
  return (
    <div className="flex flex-col gap-px">
      {sevs.map((s, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          key={i}
          className="flex h-[4px] items-center gap-[3px]"
        >
          <span
            className="h-[3px] w-[3px] shrink-0 rounded-[1px]"
            style={{
              background:
                s === 'warn' ? '#FCD34D' : s === 'err' ? '#F87171' : '#5EA3FF',
            }}
          />
          <span
            className="h-[2px] w-[10px] shrink-0 rounded-[1px]"
            style={{ background: 'hsl(var(--secondary-300))', opacity: 0.5 }}
          />
          <span
            className="h-[2px] rounded-[1px]"
            style={{
              width: `${widths[i]}%`,
              background: 'hsl(var(--secondary-300))',
              opacity: 0.55,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function RepoMini() {
  return (
    <div className="flex flex-col gap-[3px]">
      {[70, 54, 62].map((w, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          key={i}
          className="flex items-center gap-1"
        >
          <span
            className="h-[5px] w-[5px] shrink-0 rounded-full border-[1.2px]"
            style={{
              borderColor: 'hsl(var(--primary-main))',
              background: 'hsl(var(--paper))',
            }}
          />
          <span
            className="h-[2px] rounded-[1px]"
            style={{
              width: `${w}%`,
              background: 'hsl(var(--secondary-300))',
              opacity: 0.65,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function DocsMini() {
  return (
    <div className="grid h-full grid-cols-2 gap-1">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-0.5 rounded-[3px] border p-1"
          style={{ background: 'hsl(var(--secondary-100))' }}
        >
          <span
            className="h-[3px] w-[65%] rounded-[1px] opacity-70"
            style={{ background: 'hsl(var(--foreground))' }}
          />
          <span
            className="h-[2px] rounded-[1px]"
            style={{ background: 'hsl(var(--secondary-300))', opacity: 0.55 }}
          />
          <span
            className="h-[2px] w-[60%] rounded-[1px]"
            style={{ background: 'hsl(var(--secondary-300))', opacity: 0.55 }}
          />
        </div>
      ))}
    </div>
  );
}

function renderCell(item: LayoutItem) {
  switch (item.type) {
    case 'metric':
      return <MetricMini cfg={item.cfg} />;
    case 'pulse':
      return <PulseMini />;
    case 'health':
      return (
        <RowsMini
          rows={[
            { status: 'ok', w: 70, tag: true },
            { status: 'ok', w: 64, tag: true },
            { status: 'warn', w: 58, tag: true },
            { status: 'ok', w: 72, tag: true },
            { status: 'ok', w: 62, tag: true },
          ]}
        />
      );
    case 'deploys':
      return (
        <RowsMini
          rows={[
            { status: 'ok', w: 80 },
            { status: 'ok', w: 72 },
            { status: 'warn', w: 64 },
            { status: 'ok', w: 76 },
          ]}
        />
      );
    case 'logs':
      return <LogsMini />;
    case 'info':
      return (
        <RowsMini
          rows={[
            { status: 'mute', w: 50 },
            { status: 'mute', w: 70 },
            { status: 'mute', w: 40 },
            { status: 'mute', w: 65 },
          ]}
        />
      );
    case 'repo':
      return <RepoMini />;
    case 'docs':
      return <DocsMini />;
    default:
      return null;
  }
}

function titleFor(item: LayoutItem): string {
  const t = TPL_TITLES[item.type];
  if (typeof t === 'string') {
    return t;
  }
  if (t && typeof t === 'object') {
    return t[item.cfg.metric ?? 'rps'] ?? item.type;
  }
  return item.type;
}

type TemplatePreviewProps = {
  layout: DashboardLayout;
};

export default function TemplatePreview({ layout }: TemplatePreviewProps) {
  const cols = 12;
  const rows = layout.reduce((m, it) => Math.max(m, it.y + it.h), 1);

  return (
    <div
      className="grid h-full w-full gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {layout.map((item) => {
        const isMetric = item.type === 'metric';
        const isPulse = item.type === 'pulse';
        return (
          <div
            key={item.i}
            className="flex min-h-0 flex-col gap-[3px] overflow-hidden rounded-[4px] border bg-paper px-[5px] py-[4px]"
            style={{
              gridColumn: `${item.x + 1} / span ${item.w}`,
              gridRow: `${item.y + 1} / span ${item.h}`,
              padding: isMetric ? '5px 6px' : isPulse ? '4px 5px 0' : undefined,
            }}
          >
            {!isMetric ? (
              <div
                className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[6px] tracking-wide"
                style={{ color: 'hsl(var(--foreground))' }}
              >
                {titleFor(item)}
              </div>
            ) : null}
            <div
              className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden"
              style={
                isPulse
                  ? { padding: 0, margin: '-2px -3px -2px -3px' }
                  : undefined
              }
            >
              {renderCell(item)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
