import { CORE_LOG_SERVICE_TO_LABEL } from '@/features/orgs/projects/logs/utils/constants/services';

export interface ServiceStyle {
  label: string;
  className: string;
}

const FALLBACK_PALETTE = [
  'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  'bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
];

function hashServiceName(service: string): number {
  let hash = 0;
  for (let i = 0; i < service.length; i += 1) {
    hash = Math.imul(hash, 31) + service.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

export function getServiceStyle(service: string): ServiceStyle {
  if (service.startsWith('run-')) {
    return {
      label: service.slice('run-'.length) || 'Run',
      className:
        'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300',
    };
  }
  if (service.startsWith('job-backup')) {
    return {
      label: 'Backup',
      className:
        'bg-zinc-100 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-300',
    };
  }
  switch (service) {
    case 'grafana':
      return {
        label: 'Grafana',
        className:
          'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
      };
    case 'hasura-storage':
      return {
        label: 'Storage',
        className:
          'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
      };
    case 'hasura-auth':
      return {
        label: 'Auth',
        className:
          'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
      };
    case 'hasura':
      return {
        label: 'Hasura',
        className:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
      };
    case 'constellation':
      return {
        label: 'Constellation',
        className:
          'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
      };
    case 'postgres':
      return {
        label: 'Postgres',
        className:
          'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
      };
    case 'functions':
      return {
        label: 'Functions',
        className:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300',
      };
    case 'ai':
      return {
        label: 'AI',
        className:
          'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300',
      };
    case 'custom-templates-fetcher':
      return {
        label: 'Templates',
        className:
          'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
      };
    default: {
      const mapped = CORE_LOG_SERVICE_TO_LABEL[service];
      return {
        label: mapped ?? service,
        className:
          FALLBACK_PALETTE[hashServiceName(service) % FALLBACK_PALETTE.length],
      };
    }
  }
}
