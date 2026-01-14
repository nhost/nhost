export const ORGANIZATION_TYPES = [
  { value: 'personal', label: 'Personal Project' },
  { value: 'startup', label: 'Startup' },
  { value: 'agency', label: 'Agency' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'opensource', label: 'Open Source' },
  { value: 'student', label: 'Student' },
  { value: 'other', label: 'Other' },
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]['value'];
