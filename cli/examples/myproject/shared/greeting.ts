import type { Greeting } from './types.ts';

export function createGreeting(source: Greeting['source']): Greeting {
  return {
    message: 'Hello from shared code!!',
    source,
  };
}
