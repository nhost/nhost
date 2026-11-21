import { z } from 'zod';
import {
  SupportSeverities_Enum,
  SupportTicketStatuses_Enum,
  type SupportTickets_Bool_Exp,
} from '@/generated/graphql';

export const STATUSES = [
  SupportTicketStatuses_Enum.New,
  SupportTicketStatuses_Enum.WaitingForSupport,
  SupportTicketStatuses_Enum.InProgress,
  SupportTicketStatuses_Enum.WaitingForCustomer,
  SupportTicketStatuses_Enum.Resolved,
  SupportTicketStatuses_Enum.Closed,
] as const;
export const SEVERITIES = [
  SupportSeverities_Enum.Low,
  SupportSeverities_Enum.Normal,
  SupportSeverities_Enum.High,
  SupportSeverities_Enum.Urgent,
] as const;
export const SERVICES = [
  'auth',
  'database',
  'graphql',
  'storage',
  'functions',
  'run',
  'ai',
  'dashboard',
  'cli',
  'networking',
  'billing',
  'other',
] as const;
export const PAGE_SIZE = 50;

export const ticketFormSchema = z.object({
  organizationID: z.uuid('Select an organization'),
  projectID: z.union([z.uuid(), z.literal('none')]),
  title: z.string().trim().min(1, 'Add a title').max(200),
  severity: z.enum(SEVERITIES),
  services: z
    .array(z.enum(SERVICES))
    .min(1, 'Select at least one affected service'),
  description: z.string().trim().min(1, 'Describe the issue').max(50000),
});
export type TicketFormValues = z.infer<typeof ticketFormSchema>;

export const ticketSearchSchema = z.object({
  q: z.string().trim().max(200).catch(''),
  status: z.enum(['active', 'all', ...STATUSES]).catch('active'),
  organization: z.string().trim().max(200).catch(''),
  queue: z.enum(['all', 'mine', 'unassigned']).catch('all'),
  page: z.coerce.number().int().min(0).max(100000).catch(0),
});
export type TicketSearch = z.infer<typeof ticketSearchSchema>;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function ticketFilter(
  search: TicketSearch,
  userId: string,
  isAgent: boolean,
): SupportTickets_Bool_Exp {
  const filters: SupportTickets_Bool_Exp[] = [];
  if (search.status === 'active') {
    filters.push({
      status: {
        _nin: [
          SupportTicketStatuses_Enum.Resolved,
          SupportTicketStatuses_Enum.Closed,
        ],
      },
    });
  } else if (search.status !== 'all') {
    filters.push({ status: { _eq: search.status } });
  }
  if (search.organization) {
    filters.push({
      organizationName: { _ilike: `%${escapeLike(search.organization)}%` },
    });
  }
  if (isAgent && search.queue === 'mine') {
    filters.push({ assigneeID: { _eq: userId } });
  } else if (isAgent && search.queue === 'unassigned') {
    filters.push({ assigneeID: { _is_null: true } });
  }
  if (search.q) {
    filters.push({ title: { _ilike: `%${escapeLike(search.q)}%` } });
  }
  return { _and: filters };
}

export function getAllowedSupportSeverities(
  allowed: readonly string[] | null | undefined,
): SupportSeverities_Enum[] {
  return SEVERITIES.filter((severity) => allowed?.includes(severity));
}

export function supportLabel(value: string): string {
  const labels: Record<string, string> = {
    auth: 'Authentication',
    graphql: 'GraphQL',
    ai: 'AI',
    cli: 'CLI',
    run: 'Run',
  };
  return (
    labels[value] ??
    value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
  );
}

export function supportDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
