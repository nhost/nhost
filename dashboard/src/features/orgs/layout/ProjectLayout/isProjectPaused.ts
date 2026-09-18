import { ApplicationStatus } from '@/types/application';

const PAUSED_FAMILY_STATES: ApplicationStatus[] = [
  ApplicationStatus.Pausing,
  ApplicationStatus.Paused,
  ApplicationStatus.Unpausing,
  ApplicationStatus.Restoring,
];

/**
 * Whether the project is paused, pausing, waking up, or restoring — the
 * states in which a section's sub-pages (other than its own Settings) get
 * blocked. Shared by ProjectSectionContent and every section's route tabs so
 * the tab bar's disabled state and the content it's guarding never disagree.
 */
export function isProjectPaused(state: ApplicationStatus): boolean {
  return PAUSED_FAMILY_STATES.includes(state);
}
