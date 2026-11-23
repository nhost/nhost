import type { GetFileParams } from '@nhost/nhost-js/storage';
import { type DocumentNode, getOperationAST } from 'graphql';
import { SEVERITIES, STATUSES } from '@/features/support/utils/tickets';
import {
  type DashboardSupportAttachmentsQuery,
  type DashboardSupportCommentsQuery,
  type DashboardSupportEventsQuery,
  type DashboardSupportTicketQuery,
  SupportTicketEventKinds_Enum,
  SupportTicketStatuses_Enum,
  type SupportTickets_Bool_Exp,
  type SupportTickets_Set_Input,
} from '@/generated/graphql';

// Temporary browser-only fixtures. No URLs, credentials, real organizations or
// network transports belong here. Each signed-in user gets a separate sandbox.
interface SampleActor {
  id: string;
  displayName?: string | null;
}
type Ticket = NonNullable<DashboardSupportTicketQuery['supportTicket']>;
type Comment = DashboardSupportCommentsQuery['supportComments'][number];
type Event = DashboardSupportEventsQuery['supportTicketEvents'][number];
type Attachment = NonNullable<
  DashboardSupportAttachmentsQuery['supportTicket']
>['attachments'][number];
interface SampleFile {
  ticketID: string;
  attachment?: Attachment;
  blob?: Blob;
}
interface SampleState {
  tickets: Ticket[];
  comments: Map<string, Comment[]>;
  events: Map<string, Event[]>;
  files: Map<string, SampleFile>;
}
const states = new Map<string, SampleState>();
const sampleID = (index: number) =>
  `90000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const otherAgentID = sampleID(900);
const imageID = sampleID(500);
const imageBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAUAAAACgCAIAAADywSLLAAAFg0lEQVR4nO3dMY4rRBQFUXbKxtkGOZAQtrDG/asvOiVNOir3uyWH/u0PALP89vffn8vwb+HfIuAY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37Lu/0/AwLP8/gNq91+Bb+AY/md+EvAL/rcRcAz/MwI+I+AY/mcEfEbAMfzPCPiMgGP4nxHwGQHH8D8j4DMCjuF/RsBnBBzD/4yAzwg4hv8ZAZ8RcAz/MwI+I+AY/mcEfEbAMfzPCPiMgGP4nxHwGQHH8D8j4DMCjuF/RsBnBBzzmv/tYF7zee39P0XAMa/5C3gLAce85i/gLQQc85q/gLcQcMxr/gLeQsAxr/kLeAsBx7zmL+AtBBzzmr+AtxBwzGv+Am59PkXAMa/5vzbQ2z4CjuH/XV4b6G0fAcfw/y6vDfS2j4Bj+H+X1wZ620fAMfy/y2sDve0j4Bj+3+W1gd72EXAM/+/y2kBv+/wfAgb+5ScD5fPrfXwDx7zm/5OBLvp8+v6vvY+AY17zf22gt30EHMP/u7w20Ns+Ao7h/11eG+htHwHH8P8urw30to+AY/h/l9cGettHwDH8v8trA73tI+CY9QO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wO89v6vvc9tn/X9CDg+wGvv/9r73PZZ34+A4wPwaX3W9yPg+AB8Wp/1/Qg4PgCf1md9PwKOD8Cn9Vnfj4DjA/Bpfdb3I+D4AHxan/X9CDg+AJ/WZ30/Ao4PwKf1Wd/P9d8H/skH5sOHz5nr38A/+cD/5f9/6n/b51P4tD7r+xFwfAA+rc/6fgQcH4BP67O+HwHHB+DT+qzvR8DxAfi0Puv7EXB8AD6tz/p+BBwfgE/rs74fAccH4NP6rO9HwPEB+LQ+6/sRcHwAPq3P+n4EHB+AT+uzvh8Bxwfg0/qs70fA8QH4tD7r+xFwfAA+rc/6fgQcH4BP67O+HwHHB+DT+qzvR8DxAfi0Puv7EXB8AD6tz/p+BBwfgE/rs74fAccH4NP6rO9HwPEB+LQ+6/sRcHwAPq3P+n4EHB+AT+uzvh8Bxwfg0/qs70fA8QH4tD7r+xFwfAA+rc/6fgQcH4BP67O+HwHHB+DT+qzvR8DxAfi0Puv7EXB8AD6tz/p+BBwfgE/rs74fvw/Mh8+wj2/gL/t8Cp/WZ30/Ao4PwKf1Wd+PgOMD8Gl91vcj4PgAfFqf9f0IOD4An9ZnfT8Cjg/Ap/VZ34+A4wPwaX3W93M94Nvwb+HfIuAY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+Ao7h37LuL+AY/i3r/gKO4d+y7i/gGP4t6/4CjuHfsu4v4Bj+Lev+fwGzLOgkLWncrQAAAABJRU5ErkJggg==';

function imageBlob() {
  return new Blob(
    [Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0))],
    { type: 'image/png' },
  );
}
function createState(actor: SampleActor): SampleState {
  const titles = [
    "Can't connect to Postgres after upgrade",
    'Billing shows two charges this month',
    'How do I configure a custom OAuth provider?',
    'Storage uploads stop before finishing',
    'Help setting up a deployment preview',
    'How can I export my project logs?',
  ];
  const state: SampleState = {
    tickets: [],
    comments: new Map(),
    events: new Map(),
    files: new Map(),
  };
  state.tickets = titles.map((title, index): Ticket => {
    const createdAt = new Date(Date.UTC(2026, 10, 20, 9, index)).toISOString();
    const assigneeID =
      index % 3 === 0 ? actor.id : index % 3 === 1 ? otherAgentID : null;
    return {
      id: sampleID(index + 1),
      number: 1042 + index,
      title,
      status: STATUSES[index],
      severity: SEVERITIES[index % SEVERITIES.length],
      services: [
        index === 1 ? 'billing' : index === 3 ? 'storage' : 'database',
      ],
      organizationID: sampleID(100 + (index % 2)),
      organizationName: index % 2 ? 'Atlas Studio' : 'Northstar Labs',
      projectID: index === 1 ? null : sampleID(200 + (index % 2)),
      projectName: index === 1 ? null : 'Production',
      requesterID: sampleID(300 + (index % 2)),
      requesterName: index % 2 ? 'Jamie Chen' : 'Alex Morgan',
      assigneeID,
      assigneeName:
        assigneeID === actor.id
          ? actor.displayName || 'You'
          : assigneeID
            ? 'Taylor Reed'
            : null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
      description:
        index === 0
          ? 'Connections started timing out after our last upgrade. What should we check first?\n\n```text\nconnection timeout after 30 seconds\n```'
          : 'Could you help us understand the next steps? We have included the details in this sample conversation.',
      resolvedAt: index === 4 ? createdAt : null,
      closedAt: index === 5 ? createdAt : null,
      organization: { plan: { supportAllowedSeverities: [...SEVERITIES] } },
    };
  });
  for (const [index, ticket] of state.tickets.entries()) {
    state.events.set(ticket.id, [
      {
        id: sampleID(700 + index),
        actorName: ticket.requesterName,
        kind: SupportTicketEventKinds_Enum.Created,
        oldValue: null,
        newValue: null,
        createdAt: ticket.createdAt,
      },
    ]);
    const bodies =
      index === 0
        ? [
            'Thanks for the details. Are the timeouts affecting every connection?',
            `It happens during our busiest hour. Here is the connection chart.\n\n![Connection chart](attachment:${imageID})`,
            'We are checking the connection pool settings with you.',
            'Thank you. We can try the suggested settings on our preview project first.',
          ]
        : index === 1
          ? [
              'Could you share the dates shown for the two charges?',
              'Both charges appear on the same invoice date.',
              'We will check whether one is a pending authorization.',
            ]
          : [];
    state.comments.set(
      ticket.id,
      bodies
        .map(
          (body, reply): Comment => ({
            id: sampleID(1000 + index * 10 + reply),
            authorID: reply % 2 ? ticket.requesterID : otherAgentID,
            authorName: reply % 2 ? ticket.requesterName : 'Taylor Reed',
            authorRole: reply % 2 ? 'user' : 'support_agent',
            body,
            createdAt: new Date(
              Date.parse(ticket.createdAt) + (reply + 1) * 60000,
            ).toISOString(),
          }),
        )
        .reverse(),
    );
  }
  const blob = imageBlob();
  state.files.set(imageID, {
    ticketID: state.tickets[0].id,
    blob,
    attachment: {
      id: imageID,
      uploaderName: 'Alex Morgan',
      createdAt: state.tickets[0].createdAt,
      file: {
        id: imageID,
        name: 'connection-chart.png',
        size: blob.size,
        mimeType: blob.type,
      },
    },
  });
  return state;
}
function stateFor(actor: SampleActor) {
  let state = states.get(actor.id);
  if (!state) {
    state = createState(actor);
    states.set(actor.id, state);
  }
  return state;
}
export function resetSampleTickets(userID: string) {
  states.delete(userID);
}

function like(value: string, pattern: string) {
  let expression = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '\\' && index + 1 < pattern.length) {
      index += 1;
      expression += pattern[index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else {
      expression +=
        char === '%'
          ? '.*'
          : char === '_'
            ? '.'
            : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${expression}$`, 'is').test(value);
}
function matches(ticket: Ticket, where: SupportTickets_Bool_Exp): boolean {
  if (where._and && !where._and.every((filter) => matches(ticket, filter))) {
    return false;
  }
  if (where.status?._eq && ticket.status !== where.status._eq) {
    return false;
  }
  if (where.status?._nin?.includes(ticket.status)) {
    return false;
  }
  if (where.assigneeID?._eq && ticket.assigneeID !== where.assigneeID._eq) {
    return false;
  }
  if (where.assigneeID?._is_null === true && ticket.assigneeID != null) {
    return false;
  }
  if (where.title?._ilike && !like(ticket.title, where.title._ilike)) {
    return false;
  }
  if (
    where.organizationName?._ilike &&
    !like(ticket.organizationName, where.organizationName._ilike)
  ) {
    return false;
  }
  return true;
}
const transitions: DashboardSupportTicketQuery['supportTicketTransitions'] =
  STATUSES.flatMap((fromStatus) => {
    if (fromStatus === SupportTicketStatuses_Enum.Closed) {
      return [];
    }
    const targets =
      fromStatus === SupportTicketStatuses_Enum.Resolved
        ? [
            SupportTicketStatuses_Enum.WaitingForSupport,
            SupportTicketStatuses_Enum.Closed,
          ]
        : [
            SupportTicketStatuses_Enum.InProgress,
            SupportTicketStatuses_Enum.WaitingForCustomer,
            SupportTicketStatuses_Enum.Resolved,
          ];
    return targets
      .filter((toStatus) => toStatus !== fromStatus)
      .map((toStatus) => ({ fromStatus, toStatus }));
  });

export function sampleSupportRequest<TData>(
  document: DocumentNode,
  variables: Record<string, unknown>,
  actor: SampleActor,
): TData {
  const state = stateFor(actor);
  const operation = getOperationAST(document)?.name?.value;
  const ticketID = String(variables.id ?? variables.ticketId ?? '');
  const ticket = state.tickets.find((item) => item.id === ticketID);
  const offset = Math.max(0, Number(variables.offset) || 0);
  let result: unknown;
  switch (operation) {
    case 'dashboardSupportTickets':
      result = {
        supportTickets: state.tickets
          .filter((item) =>
            matches(item, variables.where as SupportTickets_Bool_Exp),
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(offset, offset + 51),
      };
      break;
    case 'dashboardSupportTicket':
      result = {
        supportTicket: ticket ?? null,
        supportTicketTransitions: transitions,
      } satisfies DashboardSupportTicketQuery;
      break;
    case 'dashboardSupportComments':
      result = {
        supportComments: (state.comments.get(ticketID) ?? []).slice(
          offset,
          offset + 51,
        ),
      } satisfies DashboardSupportCommentsQuery;
      break;
    case 'dashboardSupportEvents':
      result = {
        supportTicketEvents: (state.events.get(ticketID) ?? []).slice(0, 100),
      } satisfies DashboardSupportEventsQuery;
      break;
    case 'dashboardSupportAttachments':
      result = {
        supportTicket: ticket
          ? {
              attachments: [...state.files.values()]
                .filter((item) => item.ticketID === ticketID && item.attachment)
                .flatMap((item) => (item.attachment ? [item.attachment] : []))
                .slice(offset, offset + 100),
            }
          : null,
      } satisfies DashboardSupportAttachmentsQuery;
      break;
    case 'dashboardSupportInlineAttachment': {
      const scope = variables.scope as { ticketID?: { _eq?: string } };
      const file = state.files.get(String(variables.id));
      result = {
        supportAttachmentUploads:
          file && file.ticketID === scope.ticketID?._eq && file.attachment
            ? [{ file: file.attachment.file }]
            : [],
      };
      break;
    }
    case 'dashboardUpdateSupportTicket': {
      if (
        !ticket ||
        ticket.status === SupportTicketStatuses_Enum.Closed ||
        ticket.version !== variables.version
      ) {
        result = { updateSupportTickets: { affected_rows: 0 } };
        break;
      }
      const changes = variables.changes as SupportTickets_Set_Input;
      const now = new Date().toISOString();
      function event(
        kind: SupportTicketEventKinds_Enum,
        oldValue: string | null,
        newValue: string | null,
      ) {
        state.events
          .get(ticketID)
          ?.unshift({
            id: crypto.randomUUID(),
            actorName: actor.displayName || 'You',
            kind,
            oldValue,
            newValue,
            createdAt: now,
          });
      }
      if (changes.status) {
        if (
          !transitions.some(
            (transition) =>
              transition.fromStatus === ticket.status &&
              transition.toStatus === changes.status,
          )
        ) {
          throw new Error('This sample status transition is unavailable.');
        }
        event(
          SupportTicketEventKinds_Enum.StatusChanged,
          ticket.status,
          changes.status,
        );
        ticket.status = changes.status;
        ticket.resolvedAt =
          changes.status === SupportTicketStatuses_Enum.Resolved ? now : null;
        ticket.closedAt =
          changes.status === SupportTicketStatuses_Enum.Closed ? now : null;
      }
      if (changes.severity) {
        if (!SEVERITIES.includes(changes.severity)) {
          throw new Error('Unknown sample severity.');
        }
        event(
          SupportTicketEventKinds_Enum.SeverityChanged,
          ticket.severity,
          changes.severity,
        );
        ticket.severity = changes.severity;
      }
      if ('assigneeID' in changes) {
        event(
          SupportTicketEventKinds_Enum.AssignmentChanged,
          ticket.assigneeID ?? null,
          changes.assigneeID ?? null,
        );
        ticket.assigneeID = changes.assigneeID ?? null;
        ticket.assigneeName =
          changes.assigneeID === actor.id
            ? actor.displayName || 'You'
            : changes.assigneeID
              ? 'Taylor Reed'
              : null;
      }
      ticket.version += 1;
      ticket.updatedAt = now;
      result = { updateSupportTickets: { affected_rows: 1 } };
      break;
    }
    case 'dashboardReplyToSupportTicket': {
      if (!ticket || ticket.status === SupportTicketStatuses_Enum.Closed) {
        throw new Error('This sample ticket is read-only or unavailable.');
      }
      const comment: Comment = {
        id: crypto.randomUUID(),
        authorID: actor.id,
        authorName: actor.displayName || 'You',
        authorRole: 'support_agent',
        body: String(variables.body),
        createdAt: new Date().toISOString(),
      };
      state.comments.get(ticketID)?.unshift(comment);
      ticket.updatedAt = comment.createdAt;
      result = { insertSupportComment: { id: comment.id } };
      break;
    }
    case 'dashboardReserveSupportAttachment': {
      if (!ticket || ticket.status === SupportTicketStatuses_Enum.Closed) {
        throw new Error('This sample ticket cannot accept attachments.');
      }
      const id = crypto.randomUUID();
      state.files.set(id, { ticketID });
      result = { insertSupportAttachmentUpload: { id } };
      break;
    }
    default:
      // Fail closed. An unsupported operation must never fall through to real APIs.
      throw new Error('This operation is not available in sample Support.');
  }
  return structuredClone(result) as TData;
}

export function uploadSampleAttachment(
  actor: SampleActor,
  id: string,
  file: File,
) {
  const target = stateFor(actor).files.get(id);
  if (!target) {
    throw new Error('Sample attachment reservation not found.');
  }
  target.blob = file;
  target.attachment = {
    id,
    uploaderName: actor.displayName || 'You',
    createdAt: new Date().toISOString(),
    file: { id, name: file.name, size: file.size, mimeType: file.type },
  };
}
export async function downloadSampleAttachment(
  actor: SampleActor,
  id: string,
  transform?: GetFileParams,
): Promise<Blob> {
  const blob = stateFor(actor).files.get(id)?.blob;
  if (!blob) {
    throw new Error('Sample attachment unavailable.');
  }
  if (!transform) {
    return blob;
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(512, Math.max(1, Number(transform.w) || 128));
    canvas.height = Math.min(512, Math.max(1, Number(transform.h) || 128));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Sample thumbnail unavailable.');
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (thumbnail) => {
          if (thumbnail?.type === 'image/webp') {
            resolve(thumbnail);
          } else {
            reject(new Error('Sample thumbnail unavailable.'));
          }
        },
        'image/webp',
        0.75,
      ),
    );
  } finally {
    bitmap.close();
  }
}
