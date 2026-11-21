import type {
  CronState,
  SqlJob,
} from '@/features/orgs/projects/events/sql-jobs/types';

export const sqlJobFixture: SqlJob = {
  jobid: '9007199254740993',
  jobname: 'refresh-summary',
  schedule: '0 * * * *',
  command: 'SELECT 42;\n-- Keep SQL whitespace intact',
  database: 'postgres',
  username: 'postgres',
  active: true,
  nodename: 'localhost',
  nodeport: 5432,
  lastRun: null,
};

export const cronStateFixture: CronState = {
  database: 'postgres',
  schedulerDatabase: 'postgres',
  settings: [
    {
      name: 'cron.max_running_jobs',
      setting: '32',
      context: 'postmaster',
      pending_restart: false,
      short_desc: 'Maximum concurrent jobs.',
      min_val: '0',
      max_val: '100',
    },
    {
      name: 'cron.timezone',
      setting: 'GMT',
      context: 'postmaster',
      pending_restart: false,
      short_desc: 'Timezone used for schedules.',
      min_val: null,
      max_val: null,
    },
    {
      name: 'cron.log_run',
      setting: 'on',
      context: 'postmaster',
      pending_restart: false,
      short_desc: 'Record job runs.',
      min_val: null,
      max_val: null,
    },
  ],
};
