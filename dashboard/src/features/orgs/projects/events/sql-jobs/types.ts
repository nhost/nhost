export interface SqlJobValues {
  jobname: string;
  schedule: string;
  command: string;
  database: string;
  username: string;
  active: boolean;
}

export interface SqlJob extends Omit<SqlJobValues, 'jobname'> {
  jobid: string;
  jobname: string | null;
  nodename: string;
  nodeport: number;
  lastRun: SqlJobRun | null;
}

export interface SqlJobRun {
  runid: string;
  jobid: string;
  status: string;
  return_message: string | null;
  start_time: string | null;
  end_time: string | null;
  command: string;
}

export interface CronSetting {
  name: string;
  setting: string;
  context: string;
  pending_restart: boolean;
  short_desc: string;
  min_val: string | null;
  max_val: string | null;
}

export interface CronState {
  database: string;
  schedulerDatabase: string | null;
  settings: CronSetting[];
}

export interface SqlJobChange {
  name: string;
  up: string;
  down: string;
}
