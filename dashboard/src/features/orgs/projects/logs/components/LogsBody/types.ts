export interface LogEntry {
  timestamp: string;
  service: string;
  log: string;
}

export interface LogsData {
  logs: LogEntry[];
}
