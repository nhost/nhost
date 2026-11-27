import { createServer } from 'node:http';
import { createGreeting } from '../../../shared/greeting.ts';
import type { Greeting } from '../../../shared/types.ts';

export function createGreetingServer() {
  return createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'GET' || req.url !== '/shared-greeting') {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const greeting: Greeting = createGreeting('run-service');
    res.writeHead(200);
    res.end(JSON.stringify(greeting));
  });
}
