import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Config } from 'tailwindcss';
import resolveConfig from 'tailwindcss/resolveConfig.js';

const require = createRequire(import.meta.url);

export function loadTheme(dashboard: string) {
  const config = require(resolve(dashboard, 'tailwind.config.js')) as Config & {
    theme: { extend: { colors: Record<string, unknown> } };
  };
  return {
    declaredColors: config.theme.extend.colors,
    resolved: resolveConfig(config),
  };
}
