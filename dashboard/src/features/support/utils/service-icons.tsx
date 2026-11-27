import { SiDocker, SiGraphql } from '@icons-pack/react-simple-icons';
import {
  CircleHelpIcon,
  CodeIcon,
  CreditCardIcon,
  DatabaseIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  SparklesIcon,
  TerminalIcon,
  UserIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { SERVICES } from '@/features/support/utils/tickets';

export const SERVICE_ICONS = {
  auth: UserIcon,
  database: DatabaseIcon,
  graphql: SiGraphql,
  storage: HardDriveIcon,
  functions: CodeIcon,
  run: SiDocker,
  ai: SparklesIcon,
  dashboard: LayoutDashboardIcon,
  cli: TerminalIcon,
  networking: NetworkIcon,
  billing: CreditCardIcon,
  other: CircleHelpIcon,
} satisfies Record<
  (typeof SERVICES)[number],
  ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
>;

// Ticket services are stored strings, so names like `constructor` must not
// resolve to inherited object properties.
export function serviceIcon(service: string) {
  return Object.hasOwn(SERVICE_ICONS, service)
    ? SERVICE_ICONS[service as keyof typeof SERVICE_ICONS]
    : SERVICE_ICONS.other;
}
