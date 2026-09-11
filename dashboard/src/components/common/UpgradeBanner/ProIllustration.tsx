import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Nhost mark, used as the default centerpiece of `ProIllustration` when
 * the caller doesn't pass a feature-specific icon.
 */
function NhostMark({ className }: { className?: string }) {
  const logo =
    'M27.1494 6.85772L16.0203 0.431392C15.0218 -0.143797 13.7823 -0.143797 12.7818 0.431392C11.7833 1.00861 11.1635 2.08203 11.1635 3.23443V4.07291L10.4385 3.65367C9.44 3.07848 8.20051 3.07848 7.2 3.65367C6.20152 4.23089 5.58177 5.3043 5.58177 6.45873V7.29721L4.85671 6.87797C3.85823 6.30278 2.61873 6.30278 1.61823 6.87797C0.619745 7.45519 0 8.52861 0 9.68304V29.8187C0 30.398 0.336201 30.9367 0.858732 31.1878C1.37924 31.441 2.01114 31.3722 2.46481 31.0137L7.9838 26.6613L16.4942 31.5747C16.7291 31.7104 16.9924 31.7772 17.2557 31.7772C17.519 31.7772 17.7823 31.7084 18.0172 31.5747C18.4871 31.3033 18.7787 30.799 18.7787 30.2562V18.1387C18.7787 16.1499 17.7094 14.2987 15.9878 13.3043L13.197 11.6922V3.23646C13.197 2.80709 13.4278 2.40608 13.8005 2.19139C14.1732 1.97671 14.6349 1.97671 15.0076 2.19139L26.1367 8.6157C27.2324 9.24759 27.9129 10.4284 27.9129 11.6922V26.7808C27.9129 27.2101 27.682 27.6111 27.3094 27.8258L24.3605 29.5291V14.9144C24.3605 12.9256 23.2911 11.0744 21.5696 10.08L14.718 6.12456V8.46785L20.5549 11.838C21.6506 12.4699 22.3311 13.6486 22.3311 14.9144V30.4061C22.3311 30.9468 22.6228 31.4532 23.0927 31.7246C23.3276 31.8603 23.5909 31.9271 23.8542 31.9271C24.1175 31.9271 24.3808 31.8582 24.6157 31.7246L28.3261 29.5818C29.3246 29.0046 29.9443 27.9311 29.9443 26.7767V11.6881C29.9403 9.70532 28.8709 7.85215 27.1494 6.85772ZM14.9691 15.0623C16.0648 15.6942 16.7453 16.8729 16.7453 18.1387V29.3792L9.69722 25.3104L11.9595 23.5281C12.7433 22.9104 13.1929 21.9848 13.1929 20.9863V14.0395L14.9691 15.0623ZM11.1635 12.8648V20.9823C11.1635 21.3549 10.9954 21.7013 10.7038 21.9301L2.02937 28.7696V9.68101C2.02937 9.25165 2.26025 8.85063 2.63291 8.63595C3.00557 8.42127 3.46734 8.42127 3.84 8.63595L5.58177 9.64051V24.0304L7.61114 22.4304V6.45873C7.61114 6.02937 7.84203 5.62835 8.21468 5.41367C8.58734 5.19899 9.04911 5.19899 9.42177 5.41367L11.1635 6.41823V10.5195L9.13418 9.34684V11.6922L11.1635 12.8648Z';

  return (
    <svg viewBox="0 0 30 32" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="pro-mark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <path d={logo} fill="url(#pro-mark-gradient)" />
    </svg>
  );
}

interface ProIllustrationProps {
  className?: string;
  // The icon this feature already uses in the main menu. Falls back to the
  // Nhost mark when omitted.
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Decorative, animated mark used on the `UpgradeBanner` for Pro/Team gated
 * pages: a soft halo with a couple of slowly orbiting rings around a
 * centered icon. Purely visual, no behavior.
 */
export function ProIllustration({ className, icon: Icon }: ProIllustrationProps) {
  return (
    <div className={cn('flex h-full w-full items-center justify-end', className)}>
      {/* Fixed 3:2 box (matches the viewBox below) so the rings and the
       * icon overlay move together, and the whole graphic hugs the right
       * edge of the banner instead of centering inside a wider box. */}
      <div className="relative aspect-[3/2] h-full max-w-full">
        <svg
          viewBox="0 0 240 160"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          fill="none"
        >
          <defs>
            <linearGradient id="pro-glow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* soft halo + orbit rings */}
          <circle
            className="pro-illustration-halo"
            cx="120"
            cy="80"
            r="53"
            fill="url(#pro-glow)"
          />
          <g
            className="pro-orbit pro-orbit-inner"
            stroke="currentColor"
            fill="none"
            opacity="0.25"
          >
            <circle cx="120" cy="80" r="44" strokeWidth="1" strokeDasharray="3 6" />
          </g>
          <g
            className="pro-orbit pro-orbit-outer"
            stroke="currentColor"
            fill="none"
            opacity="0.25"
          >
            <circle
              cx="120"
              cy="80"
              r="60"
              strokeWidth="1"
              strokeDasharray="2 10"
            />
          </g>
        </svg>

        <div className="pro-illustration-icon -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2">
          {Icon ? (
            <Icon className="h-12 w-12" />
          ) : (
            <NhostMark className="h-12 w-12" />
          )}
        </div>
      </div>
    </div>
  );
}
