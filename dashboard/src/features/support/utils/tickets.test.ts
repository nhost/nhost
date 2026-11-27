import { SupportSeverities_Enum } from '@/generated/graphql';
import {
  getAllowedSupportSeverities,
  supportGap,
  supportLabel,
  ticketFilter,
  ticketFormSchema,
  ticketSearchSchema,
} from './tickets';

const organizationID = '0d9c1e17-4983-4d38-b793-1be03368bec1';
const input = {
  organizationID,
  projectID: 'none',
  title: '  Cannot sign in  ',
  description: '  Reproduction steps  ',
  severity: SupportSeverities_Enum.Normal,
  services: ['auth'],
  attachments: [],
};
const attachmentID = '41261576-2d59-4c12-bc6e-e573bdba3af1';

describe('support ticket validation and filters', () => {
  it('trims submissions and permits organization-wide tickets', () => {
    expect(ticketFormSchema.parse(input)).toMatchObject({
      title: 'Cannot sign in',
      description: 'Reproduction steps',
      projectID: 'none',
    });
  });
  it.each([
    { organizationID: 'forged' },
    { projectID: 'invalid' },
    { title: ' ' },
    { title: 'x'.repeat(201) },
    { description: ' ' },
    { description: 'x'.repeat(50001) },
    { services: [] },
    { services: ['secret'] },
    { severity: 'critical' },
  ])('rejects invalid submissions: %j', (changes) => {
    expect(ticketFormSchema.safeParse({ ...input, ...changes }).success).toBe(
      false,
    );
  });
  it.each(['pending', 'failed', 'invalid', 'unfinished'])(
    'rejects a %s attachment',
    (status) => {
      const result = ticketFormSchema.safeParse({
        ...input,
        attachments: [{ id: 'local-1', status }],
      });
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: ['attachments'],
          message:
            'Upload or remove unfinished attachments before creating the ticket.',
        }),
      ]);
    },
  );
  it('rejects an uploaded attachment the description does not link to', () => {
    const result = ticketFormSchema.safeParse({
      ...input,
      attachments: [{ id: attachmentID, status: 'uploaded' }],
    });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['attachments'],
        message:
          'Insert or remove attachments that are not in the description before creating the ticket.',
      }),
    ]);
  });
  it('accepts linked and uploading attachments', () => {
    expect(
      ticketFormSchema.safeParse({
        ...input,
        description: `Logs: [logs.txt](attachment:${attachmentID})`,
        attachments: [
          { id: attachmentID, status: 'uploaded' },
          { id: 'local-2', status: 'uploading' },
        ],
      }).success,
    ).toBe(true);
  });
  it('reports attachment problems while other fields are still empty', () => {
    const result = ticketFormSchema.safeParse({
      ...input,
      title: '',
      attachments: [{ id: 'local-1', status: 'failed' }],
    });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['title'],
      ['attachments'],
    ]);
  });
  it('normalizes malformed URL filters', () => {
    expect(
      ticketSearchSchema.parse({
        page: '-1',
        status: ['closed'],
        q: ['forged'],
        queue: 'admin',
      }),
    ).toEqual({
      page: 0,
      status: 'active',
      statusFilters: '',
      q: '',
      organization: '',
      queue: 'all',
    });
    expect(ticketSearchSchema.parse({ page: '2' }).page).toBe(2);
  });
  it('escapes SQL LIKE wildcards and applies organization, status and staff assignment filters', () => {
    const search = ticketSearchSchema.parse({
      q: '50%_\\',
      organization: 'Acme_',
      status: 'all',
      queue: 'mine',
    });
    expect(ticketFilter(search, 'user-id', true)).toEqual({
      _and: [
        { organizationName: { _ilike: '%Acme\\_%' } },
        { assigneeID: { _eq: 'user-id' } },
        {
          _or: [
            { title: { _ilike: '%50\\%\\_\\\\%' } },
            { projectName: { _ilike: '%50\\%\\_\\\\%' } },
            { organizationName: { _ilike: '%50\\%\\_\\\\%' } },
          ],
        },
      ],
    });
  });
  it('does not let customer URLs enable staff queue filtering', () => {
    expect(
      ticketFilter(
        ticketSearchSchema.parse({ status: 'all', queue: 'mine' }),
        'user-id',
        false,
      ),
    ).toEqual({ _and: [] });
  });
  it('filters active tickets and unassigned staff queues', () => {
    expect(
      ticketFilter(
        ticketSearchSchema.parse({ queue: 'unassigned' }),
        'user-id',
        true,
      ),
    ).toEqual({
      _and: [
        { status: { _nin: ['resolved', 'closed'] } },
        { assigneeID: { _is_null: true } },
      ],
    });
  });
});

describe('plan support severities', () => {
  it.each([undefined, null, []])(
    'fails closed for missing or empty entitlements (%s)',
    (allowed) => {
      expect(getAllowedSupportSeverities(allowed)).toEqual([]);
    },
  );
  it('uses the configured subset in severity order, ignoring duplicates and unknown values', () => {
    expect(
      getAllowedSupportSeverities(['urgent', 'unknown', 'low', 'urgent']),
    ).toEqual([SupportSeverities_Enum.Low, SupportSeverities_Enum.Urgent]);
  });
  it('does not assume that low is always allowed', () => {
    expect(getAllowedSupportSeverities(['high'])).toEqual([
      SupportSeverities_Enum.High,
    ]);
  });
});

describe('support labels', () => {
  it.each([
    ['auth', 'Authentication'],
    ['waiting_for_customer', 'Waiting for customer'],
    ['constructor', 'Constructor'],
    ['valueOf', 'ValueOf'],
    ['__proto__', '  proto  '],
  ])('labels %s as %j', (value, label) => {
    expect(supportLabel(value)).toBe(label);
  });
});

describe('support time gaps', () => {
  it.each([
    ['2025-12-31T23:00:00Z', '<1 min'],
    ['2026-01-01T00:00:20Z', '<1 min'],
    ['2026-01-01T00:30:00Z', '30 min'],
    ['2026-01-01T00:59:36Z', '1h'],
    ['2026-01-01T23:30:00Z', '1 day'],
    ['2026-01-04T00:00:00Z', '3 days'],
  ])('labels the gap until %s as %s', (to, label) => {
    expect(supportGap('2026-01-01T00:00:00Z', to)).toBe(label);
  });
});
