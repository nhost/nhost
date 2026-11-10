import process from 'node:process';
import { createGreetingServer } from './server.ts';

createGreetingServer().listen(8000, '0.0.0.0', () => {
  process.stdout.write('Shared-types service listening on port 8000\n');
});
