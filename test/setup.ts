// Setup jest-extended matchers for bun test
import { expect } from 'bun:test';

// Add custom matchers
expect.extend({
  toIncludeAnyMembers(received: any[], expected: any[]) {
    const pass = expected.some(item => received.includes(item));
    return {
      pass,
      message: () => 
        pass 
          ? `Expected array not to include any of ${JSON.stringify(expected)}`
          : `Expected array to include at least one of ${JSON.stringify(expected)}, but received ${JSON.stringify(received)}`
    };
  },
  
  toIncludeAllMembers(received: any[], expected: any[]) {
    const pass = expected.every(item => received.includes(item));
    return {
      pass,
      message: () =>
        pass
          ? `Expected array not to include all of ${JSON.stringify(expected)}`
          : `Expected array to include all of ${JSON.stringify(expected)}, but received ${JSON.stringify(received)}`
    };
  }
});